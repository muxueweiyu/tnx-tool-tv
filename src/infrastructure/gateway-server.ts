import http from 'http';
import { WebSocketServer } from 'ws';
import { ChannelManagerService } from '../services/channel-manager.js';
import { PlaylistService } from '../services/playlist-service.js';
import { AppConfig } from '../core/models/config.js';
import { RemoteCastService } from '../services/remote-cast-service.js';
import { WEB_UI_HTML } from './web-ui-provider.js';
import { getPreferredLanIp } from './network.js';

export class GatewayServer {
    private channelManager: ChannelManagerService;
    private playlistService: PlaylistService;
    private config: AppConfig;
    private remoteCastService: RemoteCastService;
    private httpServer: http.Server | null = null;
    private wsServer: WebSocketServer | null = null;

    constructor(
        config: AppConfig,
        channelManager: ChannelManagerService,
        playlistService: PlaylistService
    ) {
        this.config = config;
        this.channelManager = channelManager;
        this.playlistService = playlistService;
        this.remoteCastService = new RemoteCastService(config);
    }

    public start(): void {
        // 1. 启动 WebSocket 多频道数据收集服务器
        this.wsServer = new WebSocketServer({ port: this.config.wsPort });
        this.wsServer.on('connection', (ws, req) => {
            const reqUrl = req.url || '/';
            const parsedUrl = new URL(reqUrl, `http://${req.headers.host || 'localhost'}`);
            const pid = parsedUrl.searchParams.get('pid');
            const track = parsedUrl.searchParams.get('track');

            if (!pid || !track || (track !== 'video' && track !== 'audio')) {
                console.warn(`⚠️ [WS] 拒绝无效连接 (pid: ${pid}, track: ${track})`);
                ws.close();
                return;
            }

            const activeChannels = this.channelManager.getActiveChannels();
            const channel = activeChannels.get(pid);
            if (!channel) {
                console.warn(`⚠️ [WS] 拒绝未知 pid [${pid}] 的连接`);
                ws.close();
                return;
            }

            console.log(`📡 [WS] [${pid}] [${track}] 浏览器解密流客户端已连接`);

            ws.on('message', (message: Buffer) => {
                this.channelManager.handleWebSocketMessage(pid, track, message);
            });

            ws.on('error', (err) => {
                console.error(`❌ [WS] [${pid}] 连接错误:`, err.message);
            });
        });

        console.log(`🔌 WebSocket 服务器已启动，监听端口: ${this.config.wsPort}`);

        // 2. 启动 HTTP 播放分发网关
        this.httpServer = http.createServer(async (req, res) => {
            const reqUrl = req.url || '/';
            const parsedUrl = new URL(reqUrl, `http://${req.headers.host || 'localhost'}`);

            // 动态播放列表：自动适配访问主机的 IP/域名
            if (parsedUrl.pathname === '/playlist' || parsedUrl.pathname === '/playlist.m3u') {
                try {
                    const host = req.headers.host || `localhost:${this.config.httpPort}`;
                    const playlistContent = this.playlistService.getPlaylistContent(host);
                    
                    res.writeHead(200, {
                        'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(playlistContent);
                    return;
                } catch (e: any) {
                    console.error("❌ 读取播放列表失败:", e);
                    res.writeHead(500);
                    res.end("Error loading playlist");
                    return;
                }
            }

            // 直播 TS 流转发路由
            if (parsedUrl.pathname === '/live') {
                const pid = parsedUrl.searchParams.get('pid') || "600001859"; // 默认 CCTV-1
                
                res.writeHead(200, { 
                    'Content-Type': 'video/mp2t', 
                    'Connection': 'keep-alive', 
                    'Access-Control-Allow-Origin': '*' 
                });

                let stream: any = null;
                try {
                    stream = await this.channelManager.registerViewer(pid);
                    stream.pipe(res);

                    req.on('close', async () => {
                        if (stream) {
                            stream.unpipe(res);
                            await this.channelManager.unregisterViewer(pid, stream);
                        }
                    });
                } catch (err: any) {
                    console.error(`❌ [Gateway] 转发 [${pid}] 播放流失败:`, err.message || err);
                    if (stream) {
                        await this.channelManager.unregisterViewer(pid, stream);
                    }
                    res.end();
                }
                return;
            }

            // API: 获取频道列表 JSON (支持状态标记)
            if (parsedUrl.pathname === '/api/channels') {
                try {
                    const host = req.headers.host || `localhost:${this.config.httpPort}`;
                    const channels = this.playlistService.loadChannels();
                    const activeChannels = this.channelManager.getActiveChannels();
                    const data = channels.map(c => {
                        const activeInstance = activeChannels.get(c.pid);
                        return {
                            name: c.name,
                            pid: c.pid,
                            url: `http://${host}/live?pid=${c.pid}`,
                            active: !!activeInstance,
                            viewers: activeInstance ? activeInstance.viewers : 0
                        };
                    });
                    res.writeHead(200, { 
                        'Content-Type': 'application/json; charset=utf-8',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify(data));
                } catch (e: any) {
                    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: e.message || e }));
                }
                return;
            }

            // API: 获取网关系统状态
            if (parsedUrl.pathname === '/api/status') {
                try {
                    const activeTabs = this.channelManager.getActiveTabsCount();
                    const browserMemory = await this.channelManager.getBrowserMemoryUsage();
                    const activeChannels = this.channelManager.getActiveChannels();
                    const activeChannelsCount = Array.from(activeChannels.values()).filter(c => c.viewers > 0).length;

                    res.writeHead(200, { 
                        'Content-Type': 'application/json; charset=utf-8',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({
                        activeTabs,
                        browserMemory,
                        activeChannelsCount,
                        tvIp: this.config.tvIp
                    }));
                } catch (e: any) {
                    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ error: e.message || e }));
                }
                return;
            }

            // API: 触发 ADB 直投电视
            if (parsedUrl.pathname === '/api/cast') {
                const pid = parsedUrl.searchParams.get('pid');
                if (!pid) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, error: "pid is required" }));
                    return;
                }
                const channels = this.playlistService.loadChannels();
                const channel = channels.find(c => c.pid === pid);
                if (!channel) {
                    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, error: "channel not found" }));
                    return;
                }

                // 投给电视必须用局域网 IP
                const lanIp = getPreferredLanIp(this.config.tvIp);
                const streamUrl = `http://${lanIp}:${this.config.httpPort}/live?pid=${pid}`;

                try {
                    const success = await this.remoteCastService.castChannel(streamUrl, channel.name);
                    res.writeHead(200, { 
                        'Content-Type': 'application/json; charset=utf-8',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({ success }));
                } catch (e: any) {
                    res.writeHead(500, { 
                        'Content-Type': 'application/json; charset=utf-8',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({ success: false, error: e.message || e }));
                }
                return;
            }

            // API: 触发 ADB 遥控按键
            if (parsedUrl.pathname === '/api/remote/key') {
                const key = parsedUrl.searchParams.get('key');
                if (!key) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, error: "key is required" }));
                    return;
                }

                // 常用按键映射
                const KEY_MAP: Record<string, string> = {
                    'up': '19',
                    'down': '20',
                    'left': '21',
                    'right': '22',
                    'ok': '23',
                    'back': '4',
                    'home': '3',
                    'menu': '82',
                    'volumeup': '24',
                    'volumedown': '25',
                    'power': '26'
                };
                const code = KEY_MAP[key.toLowerCase()];
                if (!code) {
                    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                    res.end(JSON.stringify({ success: false, error: "invalid key" }));
                    return;
                }

                try {
                    const success = await this.remoteCastService.sendKey(code);
                    res.writeHead(200, { 
                        'Content-Type': 'application/json; charset=utf-8',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({ success }));
                } catch (e: any) {
                    res.writeHead(500, { 
                        'Content-Type': 'application/json; charset=utf-8',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(JSON.stringify({ success: false, error: e.message || e }));
                }
                return;
            }

            // 根路由：直接返回 Web 控制台页面
            if (parsedUrl.pathname === '/') {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(WEB_UI_HTML);
                return;
            }

            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end("404 Not Found. Use /playlist.m3u to get channel list.");
        });

        this.httpServer.listen(this.config.httpPort, '0.0.0.0', () => {
            console.log(`📡 HTTP 网关服务已启动，监听端口: ${this.config.httpPort}`);
        });
    }

    public stop(): void {
        if (this.wsServer) {
            this.wsServer.close();
            this.wsServer = null;
        }
        if (this.httpServer) {
            this.httpServer.close();
            this.httpServer = null;
        }
        console.log("📡 HTTP/WebSocket 网关服务已关闭");
    }
}
