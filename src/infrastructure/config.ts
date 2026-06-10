import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { AppConfig } from '../core/models/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 默认配置
const DEFAULT_CONFIG = {
    httpPort: 11888,
    wsPort: 11889,
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ffmpegPath: 'ffmpeg',
    tvIp: '192.168.5.32', // 默认电视IP，可在运行中更改或自适应
    adbPort: 5555
};

export function getFFmpegPath(): string {
    if (process.platform !== 'win32') return DEFAULT_CONFIG.ffmpegPath;
    
    const rootDir = path.resolve(process.cwd());

    // 1. 优先检测当前运行目录下是否存在 ffmpeg.exe
    const localExe = path.join(rootDir, 'ffmpeg.exe');
    if (fs.existsSync(localExe)) {
        return localExe;
    }
    
    // 2. 检测当前运行目录下的 bin/ffmpeg.exe
    const binExe = path.join(rootDir, 'bin', 'ffmpeg.exe');
    if (fs.existsSync(binExe)) {
        return binExe;
    }

    // 3. 从系统环境变量寻找
    try {
        const raw = execSync('where ffmpeg', { stdio: [] }).toString().trim().split(/\r?\n/)[0];
        if (raw && fs.existsSync(raw)) {
            return raw;
        }
    } catch (e) {}

    return DEFAULT_CONFIG.ffmpegPath;
}

export function loadConfig(): AppConfig {
    const rootDir = path.resolve(process.cwd());
    
    // 核心存储目录定义 (参考 tnx-diy-tool 结构)
    const DATA_DIR = path.join(rootDir, 'data');
    const CACHE_DIR = path.join(DATA_DIR, 'cache');
    const CONFIG_DIR = path.join(DATA_DIR, 'config');
    const LOG_DIR = path.join(DATA_DIR, 'log');

    // 确保物理目录存在
    [DATA_DIR, CACHE_DIR, CONFIG_DIR, LOG_DIR].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    const m3uPath = path.join(DATA_DIR, 'ysp.m3u');

    return {
        httpPort: DEFAULT_CONFIG.httpPort,
        wsPort: DEFAULT_CONFIG.wsPort,
        userAgent: DEFAULT_CONFIG.userAgent,
        ffmpegPath: getFFmpegPath(),
        m3uPath: m3uPath,
        tvIp: DEFAULT_CONFIG.tvIp,
        adbPort: DEFAULT_CONFIG.adbPort
    };
}
