import http from 'http';
import { WebSocketServer } from 'ws';
import url from 'url';
import { ChannelManagerService } from '../services/channel-manager.js';
import { PlaylistService } from '../services/playlist-service.js';
import { AppConfig } from '../core/models/config.js';

export class GatewayServer {
    private channelManager: ChannelManagerService;
    private playlistService: PlaylistService;
    private config: AppConfig;
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
    }

    public start(): void {
        // 1. 启动 WebSocket 多频道数据收集服务器
        this.wsServer = new WebSocketServer({ port: this.config.wsPort });
        this.wsServer.on('connection', (ws, req) => {
            const parsedUrl = url.parse(req.url || '', true);
            const pid = parsedUrl.query.pid as string;

            if (!pid) {
                console.warn("⚠️ [WS] 拒绝未指定 pid 的连接");
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

            console.log(`📡 [WS] [${pid}] 浏览器解密流客户端已连接`);

            ws.on('message', (message: Buffer) => {
                this.channelManager.handleWebSocketMessage(pid, message);
            });

            ws.on('error', (err) => {
                console.error(`❌ [WS] [${pid}] 连接错误:`, err.message);
            });
        });

        console.log(`🔌 WebSocket 服务器已启动，监听端口: ${this.config.wsPort}`);

        // 2. 启动 HTTP 播放分发网关
        this.httpServer = http.createServer(async (req, res) => {
            const parsedUrl = url.parse(req.url || '', true);

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
                const pid = (parsedUrl.query.pid as string) || "600001859"; // 默认 CCTV-1
                
                res.writeHead(200, { 
                    'Content-Type': 'video/mp2t', 
                    'Connection': 'keep-alive', 
                    'Access-Control-Allow-Origin': '*' 
                });

                try {
                    const stream = await this.channelManager.registerViewer(pid);
                    stream.pipe(res);

                    req.on('close', async () => {
                        stream.unpipe(res);
                        await this.channelManager.unregisterViewer(pid);
                    });
                } catch (err: any) {
                    console.error(`❌ [Gateway] 转发 [${pid}] 播放流失败:`, err.message || err);
                    res.end();
                }
                return;
            }

            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end("Ready. Use /playlist.m3u to get channel list.");
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
