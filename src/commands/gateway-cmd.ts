import readline from 'readline';
import { loadConfig } from '../infrastructure/config.js';
import { getPreferredLanIp } from '../infrastructure/network.js';
import { startMpvPlayer } from '../infrastructure/player-launcher.js';
import { ChannelManagerService } from '../services/channel-manager.js';
import { PlaylistService } from '../services/playlist-service.js';
import { GatewayServer } from '../infrastructure/gateway-server.js';

const IS_WIN = process.platform === 'win32';

const MPV_VARIANTS: Record<string, { name: string; cmd: string }> = {
    "1": { name: "mpv (标准版)", cmd: "mpv.bat --ytdl=no --cache=yes" },
    "2": { name: "mpv-lazy (懒人包)", cmd: "mpv-lazy.bat --ytdl=no --cache=yes" },
    "3": { name: "mpv-lite (极简版)", cmd: "mpv-lite.bat --ytdl=no --cache=yes" }
};

if (!IS_WIN) {
    Object.keys(MPV_VARIANTS).forEach(k => {
        MPV_VARIANTS[k].cmd = MPV_VARIANTS[k].cmd.replace('.bat', '');
    });
}

function askForPlayer(m3uPath: string) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    console.log(`\n🎬 播放器选择菜单 (${IS_WIN ? 'Windows' : 'Unix'}):`);
    Object.keys(MPV_VARIANTS).forEach(key => {
        console.log(` [${key}] ${MPV_VARIANTS[key].name}`);
    });
    console.log(" [0] 仅启动网关服务 (不开启播放器)");

    rl.question("\n👉 请选择 (回车默认使用 mpv-lite): ", (answer) => {
        const choice = answer.trim() === "" ? "3" : answer.trim();

        if (choice === "0") {
            console.log("👋 已选择仅运行网关。");
            rl.close();
            return;
        }

        const variant = MPV_VARIANTS[choice];
        if (!variant) {
            console.log("⚠️ 无效选择，请重新输入 0-3");
            rl.close();
            askForPlayer(m3uPath);
            return;
        }

        rl.close();
        const keyName = choice === "3" ? "lite" : (choice === "2" ? "lazy" : "standard");
        startMpvPlayer(variant.cmd, m3uPath, keyName);
    });
}

export async function runGatewayCommand(options: { player?: string }): Promise<void> {
    console.log("📡 正在初始化 Reaper Gateway 后端...");
    const config = loadConfig();
    const playlistService = new PlaylistService(config);
    const channelManager = new ChannelManagerService(config);
    const gateway = new GatewayServer(config, channelManager, playlistService);

    // 启动网关
    gateway.start();

    // IP 探测与显示
    const lanIp = getPreferredLanIp(config.tvIp);
    console.log(`\n📺 局域网电视/手机请使用此链接:`);
    console.log(`👉 http://${lanIp}:${config.httpPort}/playlist.m3u`);
    console.log(`💡 MPV 命令行推荐: mpv --no-ytdl http://${lanIp}:${config.httpPort}/playlist.m3u`);

    // 安全退出
    const cleanup = () => {
        console.log(`\n📡 [System] 正在安全清理所有进程和频道并退出...`);
        channelManager.stop();
        gateway.stop();
        process.exit();
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // 延迟 2.5 秒保证网关正常绑定后再引导播放器，或直接以非交互参数运行
    await new Promise(resolve => setTimeout(resolve, 2500));

    if (options.player) {
        if (options.player === 'none' || options.player === '0') {
            console.log("👋 已指定不开启播放器。");
        } else {
            let foundVariant: { name: string; cmd: string } | null = null;
            let keyName = 'custom';
            if (options.player === 'lite' || options.player === '3') {
                foundVariant = MPV_VARIANTS['3'];
                keyName = 'lite';
            } else if (options.player === 'lazy' || options.player === '2') {
                foundVariant = MPV_VARIANTS['2'];
                keyName = 'lazy';
            } else if (options.player === 'standard' || options.player === '1') {
                foundVariant = MPV_VARIANTS['1'];
                keyName = 'standard';
            }
            
            if (foundVariant) {
                startMpvPlayer(foundVariant.cmd, config.m3uPath, keyName);
            } else {
                console.warn(`⚠️ 未知播放器配置: ${options.player}，切换到交互式引导...`);
                askForPlayer(config.m3uPath);
            }
        }
    } else {
        askForPlayer(config.m3uPath);
    }
}
