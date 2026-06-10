import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { AppConfig } from '../core/models/config.js';

let browserInstance: Browser | null = null;

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
    if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
        console.log(`📡 [System] Playwright Chromium 共享主进程已关闭`);
    }
}

export async function createChannelContext(
    pid: string, 
    config: AppConfig
): Promise<{ context: BrowserContext; page: Page }> {
    const browser = await getBrowser();
    console.log(`🌏 [Page] [${pid}] 创建页面标签页...`);
    const context = await browser.newContext({ userAgent: config.userAgent });
    const page = await context.newPage();

    // 静态资源拦截过滤，降低 50% 内存 and CPU
    await page.route('**/*', (route) => {
        const req = route.request();
        const type = req.resourceType();
        const url = req.url();
        if (
            type === 'image' || 
            type === 'font' ||
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
        const ws = new WebSocket(`ws://localhost:${wsPort}?pid=${pid}`);
        ws.binaryType = 'arraybuffer';
        let tid = 0;
        const org = SourceBuffer.prototype.appendBuffer;
        SourceBuffer.prototype.appendBuffer = function(d: BufferSource) {
            const self = this as any;
            if (self.__reaperId === undefined) self.__reaperId = ++tid;
            
            const buf = d instanceof ArrayBuffer ? d : (d as ArrayBufferView).buffer;
            const byteOffset = (d as ArrayBufferView).byteOffset || 0;
            const byteLength = d.byteLength;
            const dataBytes = new Uint8Array(buf, byteOffset, byteLength);
            
            const p = new Uint8Array(dataBytes.byteLength + 1);
            p[0] = self.__reaperId;
            p.set(dataBytes, 1);
            
            if (ws.readyState === 1) ws.send(p);
            return org.call(this, d);
        };
    }, { wsPort: config.wsPort, pid });

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

        // 2. 定期裁剪和静音视频
        const wakeUp = setInterval(() => {
            const v = document.querySelector('video');
            if (v && v.readyState >= 2) {
                v.muted = true;
                // 核心优化：将视频缩放到极小，强制不进行主画面解码与渲染，节省 80% 渲染 CPU
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
