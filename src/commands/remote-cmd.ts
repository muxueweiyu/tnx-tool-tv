import readline from 'readline';
import { loadConfig } from '../infrastructure/config.js';
import { getPreferredLanIp } from '../infrastructure/network.js';
import { PlaylistService } from '../services/playlist-service.js';
import { RemoteCastService } from '../services/remote-cast-service.js';

export function runRemoteCommand(options: { tvIp?: string }): void {
    const config = loadConfig();
    const tvIp = options.tvIp || config.tvIp;
    
    // 获取本机真实局域网 IP，优先寻找与电视同网段的
    const pcIp = getPreferredLanIp(tvIp);
    
    const playlistService = new PlaylistService(config);
    const remoteCastService = new RemoteCastService(config);
    
    // 加载频道并将 localhost 替换为本机 IP 方便电视访问
    const channels = playlistService.loadChannels(pcIp);
    
    if (channels.length === 0) {
        console.error("❌ 无法加载频道列表，请检查 data/ysp.m3u 是否存在。");
        return;
    }
    
    // 连接 ADB 设备
    console.log(`🔌 正在连接 ADB 电视: ${tvIp}...`);
    remoteCastService.connect(tvIp);
    
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    const printMenu = () => {
        console.log(`\n📺 CognitiveTV 局域网遥控器 (Node.js/TS 整理版)`);
        console.log(`📡 本机服务 IP: ${pcIp}`);
        console.log(`🎯 目标电视 IP: ${tvIp}`);
        console.log('-'.repeat(50));
        
        let buffer = "";
        channels.forEach((ch, idx) => {
            const num = (idx + 1).toString().padStart(2, '0');
            let name = ch.name;
            const displayLen = name.replace(/[^\x00-\xff]/g, "xx").length;
            if (displayLen > 14) name = name.substring(0, 8) + '..';
            
            const entry = `[${num}] ${name}`.padEnd(20);
            buffer += entry;
            
            if ((idx + 1) % 3 === 0) buffer += "\n";
        });
        console.log(buffer);
        console.log("\n👉 请输入频道序号 (q 退出): ");
    };
    
    const loop = () => {
        printMenu();
        rl.question('', (answer) => {
            const input = answer.trim().toLowerCase();
            if (input === 'q') {
                console.log("👋 已退出遥控器。");
                rl.close();
                process.exit(0);
            }
            
            const idx = parseInt(input) - 1;
            if (!isNaN(idx) && idx >= 0 && idx < channels.length) {
                remoteCastService.castChannel(channels[idx].url, channels[idx].name, tvIp).then(() => {
                    setTimeout(loop, 1000);
                });
            } else {
                console.log("⚠️ 无效序号，请重新输入");
                setTimeout(loop, 500);
            }
        });
    };
    
    loop();
}
