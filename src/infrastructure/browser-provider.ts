import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { AppConfig } from '../core/models/config.js';

class AsyncLock {
    private promise: Promise<void> = Promise.resolve();

    async acquire(): Promise<() => void> {
        let release: () => void;
        const nextPromise = new Promise<void>((resolve) => {
            release = resolve;
        });
        const currentPromise = this.promise;
        this.promise = nextPromise;
        await currentPromise;
        return release!;
    }
}

const lock = new AsyncLock();
let browserInstance: Browser | null = null;
let sharedContext: BrowserContext | null = null;

export async function getBrowser(): Promise<Browser> {
    if (!browserInstance) {
        const launchArgs = [
            '--no-sandbox', 
            '--disable-gpu',
            '--disable-software-rasterizer',
            '--disable-dev-shm-usage',
            '--mute-audio',
            '--blink-settings=imagesEnabled=false'
        ];
        if (process.platform === 'darwin') {
            launchArgs.push('--autoplay-policy=no-user-gesture-required');
        }
        console.log(`📡 [System] 正在启动 Playwright Chromium 共享主进程 (低功耗模式)...`);
        browserInstance = await chromium.launch({
            headless: true,
            args: launchArgs
        });
        console.log(`🚀 [System] Playwright Chromium 已就绪`);
    }
    return browserInstance;
}

export async function closeBrowser(): Promise<void> {
    const release = await lock.acquire();
    try {
        if (sharedContext) {
            await sharedContext.close().catch(() => {});
            sharedContext = null;
            console.log(`📡 [System] Playwright Chromium 共享上下文已关闭`);
        }
        if (browserInstance) {
            await browserInstance.close();
            browserInstance = null;
            console.log(`📡 [System] Playwright Chromium 共享主进程已关闭`);
        }
    } finally {
        release();
    }
}

export async function getSharedContext(config: AppConfig): Promise<BrowserContext> {
    if (!sharedContext) {
        const browser = await getBrowser();
        console.log(`📡 [System] 正在初始化 Playwright Chromium 共享上下文...`);
        sharedContext = await browser.newContext({ userAgent: config.userAgent });
        console.log(`🚀 [System] 共享上下文已初始化`);
    }
    return sharedContext;
}

export async function createChannelPage(
    pid: string, 
    config: AppConfig
): Promise<Page> {
    const release = await lock.acquire();
    try {
        const context = await getSharedContext(config);
        console.log(`🌏 [Page] [${pid}] 创建页面标签页 (使用共享上下文)...`);
        const page = await context.newPage();

        try {
            // 静态资源拦截过滤，降低 50% 内存 and CPU (保留 CSS 保证播放器布局，仅拦截图片、字体和追踪脚本)
            await page.route('**/*', (route) => {
                const req = route.request();
                const type = req.resourceType();
                const url = req.url().toLowerCase();
                if (
                    type === 'image' || 
                    type === 'font' ||
                    url.endsWith('.svg') ||
                    url.includes('.svg?') ||
                    url.endsWith('.woff') ||
                    url.endsWith('.woff2') ||
                    url.endsWith('.ttf') ||
                    url.includes('google-analytics') ||
                    url.includes('doubleclick') ||
                    url.includes('adservice')
                ) {
                    route.abort();
                } else {
                    route.continue();
                }
            });

            // 注入包含 pid 身份标识 of WebSocket 连接，拦截 SourceBuffer.appendBuffer
            await page.addInitScript(({ wsPort, pid }) => {
                // 1. 双通道 WebSocket 及发送队列
                const videoWs = new WebSocket(`ws://localhost:${wsPort}?pid=${pid}&track=video`);
                videoWs.binaryType = 'arraybuffer';
                const audioWs = new WebSocket(`ws://localhost:${wsPort}?pid=${pid}&track=audio`);
                audioWs.binaryType = 'arraybuffer';

                const videoQueue: Uint8Array[] = [];
                const audioQueue: Uint8Array[] = [];

                videoWs.onopen = () => {
                    console.log('📡 [WS] 视频连接就绪，清空队列中的 ' + videoQueue.length + ' 个数据包');
                    while (videoQueue.length > 0) {
                        const pkt = videoQueue.shift();
                        if (pkt) videoWs.send(pkt);
                    }
                };

                audioWs.onopen = () => {
                    console.log('📡 [WS] 音频连接就绪，清空队列中的 ' + audioQueue.length + ' 个数据包');
                    while (audioQueue.length > 0) {
                        const pkt = audioQueue.shift();
                        if (pkt) audioWs.send(pkt);
                    }
                };

                // 2. 劫持 addSourceBuffer 标记轨道
                const orgAddSourceBuffer = MediaSource.prototype.addSourceBuffer;
                MediaSource.prototype.addSourceBuffer = function (mimeType: string) {
                    const sb = orgAddSourceBuffer.call(this, mimeType);
                    const self = sb as any;
                    if (mimeType.includes('video')) {
                        self.__trackType = 'video';
                    } else if (mimeType.includes('audio')) {
                        self.__trackType = 'audio';
                    }
                    return sb;
                };

                // 3. 劫持 appendBuffer 发送 raw ArrayBuffer
                const orgAppendBuffer = SourceBuffer.prototype.appendBuffer;
                SourceBuffer.prototype.appendBuffer = function (d: BufferSource) {
                    const self = this as any;
                    
                    // 提取精准的字节切片，防止发送大 ArrayBuffer 里的冗余或偏移数据
                    const buf = d instanceof ArrayBuffer ? d : d.buffer;
                    const offset = (d as ArrayBufferView).byteOffset || 0;
                    const len = d.byteLength;
                    const slice = new Uint8Array(buf, offset, len);

                    if (self.__trackType === 'video') {
                        if (videoWs.readyState === 1) {
                            videoWs.send(slice);
                        } else {
                            videoQueue.push(slice);
                        }
                    } else if (self.__trackType === 'audio') {
                        if (audioWs.readyState === 1) {
                            audioWs.send(slice);
                        } else {
                            audioQueue.push(slice);
                        }
                    }
                    return orgAppendBuffer.call(this, d);
                };
            }, { wsPort: config.wsPort, pid });

            return page;
        } catch (err) {
            await page.close().catch(() => {});
            throw err;
        }
    } finally {
        release();
    }
}

export async function closeChannelPage(page: Page | null): Promise<void> {
    if (!page) return;
    const release = await lock.acquire();
    try {
        if (!page.isClosed()) {
            await page.close().catch(() => {});
            console.log(`🗑️ [Page] 标签页已安全关闭`);
        }
    } finally {
        release();
    }
}

export async function createChannelContext(
    pid: string, 
    config: AppConfig
): Promise<{ context: BrowserContext; page: Page }> {
    const page = await createChannelPage(pid, config);
    const context = await getSharedContext(config);
    return { context, page };
}

export async function loadAndPlay(page: Page, pid: string): Promise<void> {
    const target = `https://www.yangshipin.cn/tv/home?pid=${pid}`;
    console.log(`🌏 [Page] [${pid}] 正在前往: ${target}`);
    await page.goto(target, { waitUntil: 'commit', timeout: 30000 });
    
    // 注入低 CPU 优化：移除多余 DOM、禁用动画、将视频缩小到 1px 防止渲染开销
    await page.evaluate(() => {
        // 1. 注入全局 CSS 强制禁用所有 CSS 动画
        const style = document.createElement('style');
        style.textContent = `
            *, *::before, *::after {
                animation: none !important;
                transition: none !important;
            }
            /* 隐藏无关侧边栏、弹幕容器、页眉页脚等降低排版引擎压力 */
            .ysp-header, .ysp-footer, .side-bar, .danmu-container, .barrage-layer, .right-panel, .recommend-card, .comment-section {
                display: none !important;
            }
        `;
        document.head.appendChild(style);

        // 2. 初始播放唤醒
        const wakeUp = setInterval(() => {
            const v = document.querySelector('video');
            if (v && v.readyState >= 2) {
                v.muted = true;
                v.style.width = '1px';
                v.style.height = '1px';
                v.style.opacity = '0.001';
                v.style.position = 'absolute';
                v.style.left = '-9999px';
                
                v.play()
                    .then(() => clearInterval(wakeUp))
                    .catch(() => {});
            }
            const b = document.querySelector('.video-player') as HTMLElement; 
            if (b) b.click();
        }, 500);
        setTimeout(() => clearInterval(wakeUp), 10000);

        // 3. 持续性 Tab Keep-Alive 脚本，每 5 秒守护一次
        const keepAliveInterval = setInterval(() => {
            const v = document.querySelector('video');
            if (v) {
                v.muted = true;
                if (v.paused) {
                    v.play().catch(() => {});
                }
                v.style.width = '1px';
                v.style.height = '1px';
                v.style.opacity = '0.001';
                v.style.position = 'absolute';
                v.style.left = '-9999px';
            }
            
            // 点击播放器以激活或关闭暂停蒙层
            const player = document.querySelector('.video-player') as HTMLElement;
            if (player && v && v.paused) {
                player.click();
            }
            
            // 模拟用户交互以防挂起
            window.dispatchEvent(new MouseEvent('mousemove'));
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        }, 5000);
    });
}

export async function getPageJSHeapMemory(page: Page): Promise<number> {
    try {
        if (page && !page.isClosed()) {
            return await page.evaluate(() => {
                const perf = window.performance as any;
                return perf && perf.memory ? perf.memory.usedJSHeapSize : 0;
            });
        }
    } catch (e) {}
    return 0;
}
