import { PassThrough, Writable } from 'stream';
import { Page, BrowserContext } from 'playwright';
import { ChildProcess } from 'child_process';
import { TrackMap, StreamState, ChannelStatus } from '../core/models/channel.js';
import { AppConfig } from '../core/models/config.js';
import { createChannelContext, loadAndPlay, getPageJSHeapMemory, closeChannelPage } from '../infrastructure/browser-provider.js';
import { spawnFFmpeg, safeWrite } from '../infrastructure/ffmpeg-provider.js';
import { getTimescale, cleanAndSyncFragment } from '../infrastructure/mp4-sync.js';

export class ChannelInstance {
    public pid: string;
    public page: Page | null = null;
    public context: BrowserContext | null = null;
    public ffmpeg: ChildProcess | null = null;
    public viewers: number = 0;
    public cleanupTimer: NodeJS.Timeout | null = null;
    public lastDataTime: number = Date.now();
    public viewerStreams = new Set<PassThrough>();
    
    public trackMap: TrackMap = {
        video: { id: null, header: null, buffer: [] },
        audio: { id: null, header: null, buffer: [] }
    };

    public streamState: StreamState = {
        streamStartOrigTime: null,
        tracks: {
            video: { lastOutDtsEnd: null, timescale: 90000 },
            audio: { lastOutDtsEnd: null, timescale: 44100 }
        }
    };

    constructor(pid: string) {
        this.pid = pid;
    }
}

export class ChannelManagerService {
    private channels = new Map<string, ChannelInstance>();
    private config: AppConfig;
    private heartbeatTimer: NodeJS.Timeout | null = null;

    constructor(config: AppConfig) {
        this.config = config;
        this.startHeartbeat();
    }

    public getActiveChannels(): Map<string, ChannelInstance> {
        return this.channels;
    }

    public async registerViewer(pid: string): Promise<PassThrough> {
        let channel = this.channels.get(pid);

        if (!channel) {
            console.log(`📡 [Active] 激活并发频道: ${pid}`);
            channel = new ChannelInstance(pid);
            this.channels.set(pid, channel);
            
            // 异步启动浏览器并播放
            this.launchChannel(channel).catch(err => {
                console.error(`❌ [Channel] [${pid}] 启动失败:`, err);
            });
        } else {
            // 如果存在待销毁计时器，立即撤销
            if (channel.cleanupTimer) {
                clearTimeout(channel.cleanupTimer);
                channel.cleanupTimer = null;
                console.log(`📡 [Cancel Cleanup] 频道 [${pid}] 重新被观众连接，取消清理计划`);
            }
            
            // 如果流已经是健康的，复用它
            const isStreamHealthy = channel.ffmpeg && (Date.now() - channel.lastDataTime < 5000);
            if (isStreamHealthy) {
                console.log(`📡 [Join] 观众加入已有流 [${pid}]，执行多端复用`);
            } else {
                console.log(`📡 [Re-Connect] 频道 [${pid}] 流已失效，执行热重启...`);
                if (channel.ffmpeg) {
                    try { channel.ffmpeg.kill('SIGKILL'); } catch (e) {}
                }
                channel.trackMap.video.buffer = [];
                channel.trackMap.audio.buffer = [];
                this.startFFmpeg(channel);
            }
        }

        channel.viewers++;
        const viewerStream = new PassThrough({ highWaterMark: 1024 * 1024 }); // 1MB 独立缓冲区
        viewerStream.on('error', () => {});
        channel.viewerStreams.add(viewerStream);

        const activeTabs = this.getActiveTabsCount();
        const mem = await this.getBrowserMemoryUsage();
        console.log(`📡 [Count] 频道 [${pid}] 观众加入 | 活跃观众数: ${channel.viewers} | 共享浏览器内存: ${mem} | 活跃标签数: ${activeTabs}`);
        
        return viewerStream;
    }

    public async unregisterViewer(pid: string, viewerStream: PassThrough): Promise<void> {
        const channel = this.channels.get(pid);
        if (!channel) return;

        channel.viewerStreams.delete(viewerStream);
        viewerStream.destroy();

        channel.viewers--;
        const activeTabs = this.getActiveTabsCount();
        const mem = await this.getBrowserMemoryUsage();
        console.log(`📡 [Count] 观众退出 [${pid}] | 活跃观众数: ${channel.viewers} | 共享浏览器内存: ${mem} | 活跃标签数: ${activeTabs}`);

        // 10 秒延迟安全销毁机制
        if (channel.viewers <= 0) {
            console.log(`📡 [Schedule Cleanup] 频道 [${pid}] 观众归零，10秒后执行清理计划...`);
            channel.cleanupTimer = setTimeout(async () => {
                await this.destroyChannel(pid);
                const currentTabs = this.getActiveTabsCount();
                const currentMem = await this.getBrowserMemoryUsage();
                console.log(`🗑️ [Destroy] 频道 [${pid}] 已销毁释放 | 共享浏览器内存: ${currentMem} | 活跃标签数: ${currentTabs}`);
            }, 10000);
        }
    }

    public handleWebSocketMessage(pid: string, track: string, chunk: Buffer): void {
        const channel = this.channels.get(pid);
        if (!channel) {
            return;
        }

        channel.lastDataTime = Date.now();
        const isHeader = chunk.indexOf(Buffer.from([0x66, 0x74, 0x79, 0x70])) !== -1;
        const trackMap = channel.trackMap;

        if (isHeader) {
            console.log(`💎 [Header] [${pid}] 识别到 ${track.toUpperCase()} 轨道头部`);
            if (track === 'video') {
                trackMap.video.header = chunk;
                const ts = getTimescale(chunk);
                if (ts) channel.streamState.tracks.video.timescale = ts;
            } else if (track === 'audio') {
                trackMap.audio.header = chunk;
                const ts = getTimescale(chunk);
                if (ts) channel.streamState.tracks.audio.timescale = ts;
            }
            if (trackMap.video.header && trackMap.audio.header) {
                this.startFFmpeg(channel);
            }
            return;
        }

        if (track === 'video') {
            const processed = cleanAndSyncFragment(chunk, 'video', channel.streamState, pid);
            if (channel.ffmpeg) {
                safeWrite(channel.ffmpeg.stdin, processed);
            } else {
                trackMap.video.buffer.push(processed);
            }
            return;
        }

        if (track === 'audio') {
            const processed = cleanAndSyncFragment(chunk, 'audio', channel.streamState, pid);
            const audioInput = channel.ffmpeg?.stdio[3] as Writable | undefined;
            if (channel.ffmpeg && audioInput) {
                safeWrite(audioInput, processed);
            } else {
                trackMap.audio.buffer.push(processed);
            }
            return;
        }
    }

    private async launchChannel(channel: ChannelInstance): Promise<void> {
        try {
            const { context, page } = await createChannelContext(channel.pid, this.config);
            channel.context = context;
            channel.page = page;
            await loadAndPlay(page, channel.pid);
        } catch (e: any) {
            console.error(`⚠️ [Page] [${channel.pid}] 导航或注入失败:`, e.message || e);
        }
    }

    private startFFmpeg(channel: ChannelInstance): void {
        if (channel.ffmpeg) return;
        if (!channel.trackMap.video.header || !channel.trackMap.audio.header) return;

        const child = spawnFFmpeg(this.config.ffmpegPath, channel.pid);
        channel.ffmpeg = child;

        // 写入视频头和缓存分片
        safeWrite(child.stdin, channel.trackMap.video.header);
        channel.trackMap.video.buffer.forEach(b => safeWrite(child.stdin, b));
        channel.trackMap.video.buffer = [];

        // 写入音频头和缓存分片
        const audioInput = child.stdio[3] as Writable;
        safeWrite(audioInput, channel.trackMap.audio.header);
        channel.trackMap.audio.buffer.forEach(b => safeWrite(audioInput, b));
        channel.trackMap.audio.buffer = [];

        // 管道输出
        child.stdout?.on('data', (chunk: Buffer) => {
            for (const clientStream of channel.viewerStreams) {
                if (clientStream.writable && !clientStream.destroyed) {
                    const ok = clientStream.write(chunk);
                    if (!ok) {
                        // 客户端消费过慢，如果积压过大（如超过 8MB），强行销毁
                        if (clientStream.writableLength > 8 * 1024 * 1024) {
                            console.warn(`⚠️ [Manager] [${channel.pid}] 客户端流积压严重 (${(clientStream.writableLength / 1024 / 1024).toFixed(1)}MB)，主动断开`);
                            clientStream.destroy();
                            channel.viewerStreams.delete(clientStream);
                        }
                    }
                }
            }
        });
        
        child.on('exit', () => {
            channel.ffmpeg = null;
            // 通知并结束所有客户端流
            for (const clientStream of channel.viewerStreams) {
                try { clientStream.end(); } catch (e) {}
            }
            channel.viewerStreams.clear();
        });
    }

    public async destroyChannel(pid: string): Promise<void> {
        const channel = this.channels.get(pid);
        if (!channel) return;

        console.log(`🗑️ [Destroy] 开始销毁频道 [${pid}] 并释放资源...`);
        
        if (channel.ffmpeg) {
            try { channel.ffmpeg.kill('SIGKILL'); } catch (e) {}
            channel.ffmpeg = null;
        }

        if (channel.page) {
            try { await closeChannelPage(channel.page); } catch (e) {}
            channel.page = null;
        }

        channel.context = null;

        for (const clientStream of channel.viewerStreams) {
            try { clientStream.destroy(); } catch (e) {}
        }
        channel.viewerStreams.clear();

        this.channels.delete(pid);
        console.log(`🗑️ [Destroy] 频道 [${pid}] 释放完成`);
    }

    public getActiveTabsCount(): number {
        return Array.from(this.channels.values()).filter(c => c.page !== null).length;
    }

    public async getBrowserMemoryUsage(): Promise<string> {
        let totalBytes = 0;
        for (const channel of this.channels.values()) {
            if (channel.page) {
                const bytes = await getPageJSHeapMemory(channel.page);
                totalBytes += bytes;
            }
        }
        if (totalBytes > 0) {
            return (totalBytes / (1024 * 1024)).toFixed(1) + " MB (JS Heap)";
        }
        return "0.0 MB";
    }

    private startHeartbeat(): void {
        this.heartbeatTimer = setInterval(async () => {
            const activeChannels = Array.from(this.channels.values()).filter(c => c.viewers > 0);
            const activeTabs = this.getActiveTabsCount();
            if (activeChannels.length > 0) {
                const mem = await this.getBrowserMemoryUsage();
                console.log(`📡 [System] 心跳守护运行中 (活跃频道数: ${activeChannels.length}) | 共享浏览器内存: ${mem} | 活跃标签数: ${activeTabs}`);
            }
            for (const [pid, channel] of this.channels.entries()) {
                if (channel.viewers > 0 && Date.now() - channel.lastDataTime > 40000) {
                    console.log(`⚠️ [System] [${pid}] 流传输卡死或中断，执行自动热重启...`);
                    
                    if (channel.ffmpeg) {
                        try { channel.ffmpeg.kill('SIGKILL'); } catch (e) {}
                        channel.ffmpeg = null;
                    }
                    
                    channel.trackMap = {
                        video: { id: null, header: null, buffer: [] },
                        audio: { id: null, header: null, buffer: [] }
                    };
                    
                    channel.streamState.streamStartOrigTime = null;
                    channel.streamState.tracks.video.lastOutDtsEnd = null;
                    channel.streamState.tracks.audio.lastOutDtsEnd = null;

                    if (channel.page) {
                        try { await closeChannelPage(channel.page); } catch (e) {}
                        channel.page = null;
                    }
                    channel.context = null;

                    // 热重启加载
                    this.launchChannel(channel).catch(err => {
                        console.error(`❌ [Channel] 热重启 [${pid}] 失败:`, err);
                    });
                    channel.lastDataTime = Date.now();
                }
            }
        }, 15000);
    }

    public stop(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
        for (const channel of this.channels.values()) {
            if (channel.ffmpeg) {
                try { channel.ffmpeg.kill('SIGKILL'); } catch (e) {}
            }
        }
        this.channels.clear();
    }
}
