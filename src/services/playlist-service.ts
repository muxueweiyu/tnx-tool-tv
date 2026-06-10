import { fileExists, readTextFile } from '../infrastructure/file-system.js';
import { ChannelInfo } from '../core/models/channel.js';
import { AppConfig } from '../core/models/config.js';

export class PlaylistService {
    private config: AppConfig;

    constructor(config: AppConfig) {
        this.config = config;
    }

    loadChannels(ipToReplace?: string): ChannelInfo[] {
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
                let url = line;
                if (ipToReplace) {
                    url = url.replace(/localhost/g, ipToReplace).replace(/127\.0\.0\.1/g, ipToReplace);
                }
                const pidMatch = url.match(/pid=(\d+)/);
                const pid = pidMatch ? pidMatch[1] : '';
                
                channels.push({ name: currentName, url, pid });
                currentName = null;
            }
        });
        
        return channels;
    }

    getPlaylistContent(hostHeader: string): string {
        const filePath = this.config.m3uPath;
        if (!fileExists(filePath)) {
            throw new Error(`Playlist file not found: ${filePath}`);
        }
        let content = readTextFile(filePath);
        // 替换 localhost:11888 为实际访问主机头
        content = content.replace(/localhost:11888/g, hostHeader);
        return content;
    }
}
