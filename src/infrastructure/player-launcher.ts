import { spawn, execSync } from 'child_process';

const IS_WIN = process.platform === 'win32';

export function findExecutable(cmd: string): string | null {
    try {
        const command = IS_WIN ? `where ${cmd}` : `which ${cmd}`;
        const stdout = execSync(command, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().split(/\r?\n/)[0];
        if (stdout && stdout.trim()) return stdout.trim();
    } catch (e) {}
    return null;
}

export function startMpvPlayer(playerCmd: string, m3uPath: string, variantKey: string): void {
    const fullCmd = playerCmd.split(' ');
    const exeName = fullCmd[0];
    const flags = fullCmd.slice(1);
    
    let exePath = findExecutable(exeName);

    // 自动降级逻辑
    if (!exePath && exeName.startsWith('mpv')) {
        const fallback = IS_WIN ? 'mpv.exe' : 'mpv';
        console.warn(`⚠️ 找不到命令 "${exeName}"，尝试回退到标准 "${fallback}"...`);
        exePath = findExecutable(fallback);
    }

    if (!exePath) {
        console.error(`❌ 致命错误：找不到播放器 "${exeName}"。请确认 mpv 已安装并在系统 PATH 中。`);
        return;
    }

    const args = [...flags, m3uPath];
    
    // 全平台强制弹窗
    if (!args.includes('--force-window=immediate')) args.unshift('--force-window=immediate');
    
    console.log(`🚀 启动 ${variantKey} 播放器...`);
    
    if (IS_WIN) {
        // Windows: 使用 shell: true 兼容 .bat，detached: true 防止挂死
        const player = spawn(exePath, args, {
            stdio: 'ignore', 
            shell: true,
            detached: true,
            env: { ...process.env, no_proxy: 'localhost,127.0.0.1' }
        });
        player.on('error', err => console.error(`❌ 启动失败: ${err.message}`));
        player.unref();
        console.log(`✅ 启动指令已发送 (Windows Shell)。`);
    } else {
        // Mac/Linux: 
        // 1. 禁用硬解 (--hwdec=no) 以保证时间戳精准还原，解决音画不同步
        // 2. 诊断模式 - 贴身运行，显示日志
        const unixArgs = ['--hwdec=no', ...args];
        
        console.log(`🚀 启动 ${variantKey} 播放器 (附着调试模式)...`);
        const player = spawn(exePath, unixArgs, {
            stdio: 'inherit', 
            detached: false,
            env: { ...process.env, no_proxy: 'localhost,127.0.0.1' }
        });
        player.on('error', err => console.error(`❌ 启动失败: ${err.message}`));
        console.log(`✅ 播放器已启动。`);
    }
}
