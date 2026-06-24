import { fileExists, readTextFile } from '../infrastructure/file-system.js';
import { ChannelInfo } from '../core/models/channel.js';
import { AppConfig } from '../core/models/config.js';

export class PlaylistService {
    private config: AppConfig;
    private cachedChannels: ChannelInfo[] | null = null;
    private cachedRawContent: string | null = null;

    constructor(config: AppConfig) {
        this.config = config;
    }

    /**
     * 清空内存缓存，用于外部重载播放列表
     */
    public reload(): void {
        this.cachedChannels = null;
        this.cachedRawContent = null;
    }

    loadChannels(ipToReplace?: string): ChannelInfo[] {
        if (!this.cachedChannels) {
            const filePath = this.config.m3uPath;
            if (!fileExists(filePath)) {
                console.error(`❌ 找不到文件: ${filePath}`);
                return [];
            }

            const content = readTextFile(filePath);
            const lines = content.split(/\r?\n/);
            const channels: ChannelInfo[] = [];
            
            let currentName: string | null = null;
            
            lines.forEach(line => {
                line = line.trim();
                if (line.startsWith('#EXTINF')) {
                    const tvgMatch = line.match(/tvg-name="([^"]+)"/);
                    if (tvgMatch) {
                        currentName = tvgMatch[1];
                    } else {
                        const parts = line.split(',');
                        currentName = parts[parts.length - 1].trim();
                    }
                } else if (line.startsWith('http') && currentName) {
                    const url = line;
                    const pidMatch = url.match(/pid=(\d+)/);
                    const pid = pidMatch ? pidMatch[1] : '';
                    
                    channels.push({ name: currentName, url, pid });
                    currentName = null;
                }
            });
            
            this.cachedChannels = channels;
        }

        // 如果需要进行 IP 替换，基于缓存的原始频道进行映射，确保缓存不被污染
        if (ipToReplace) {
            return this.cachedChannels.map(c => {
                const url = c.url.replace(/localhost/g, ipToReplace).replace(/127\.0\.0\.1/g, ipToReplace);
                return { ...c, url };
            });
        }
        
        return this.cachedChannels;
    }

    getPlaylistContent(hostHeader: string): string {
        if (!this.cachedRawContent) {
            const filePath = this.config.m3uPath;
            if (!fileExists(filePath)) {
                throw new Error(`Playlist file not found: ${filePath}`);
            }
            this.cachedRawContent = readTextFile(filePath);
        }
        // 替换 localhost:11888 为实际访问主机头并返回
        return this.cachedRawContent.replace(/localhost:11888/g, hostHeader);
    }
}

