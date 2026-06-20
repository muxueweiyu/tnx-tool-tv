import { exec, execSync } from 'child_process';

export function connectTv(tvIp: string, adbPort: number): boolean {
    try {
        console.log(`📡 [ADB] 正在连接电视: ${tvIp}:${adbPort}...`);
        execSync(`adb connect ${tvIp}:${adbPort}`, { stdio: 'ignore', timeout: 5000 });
        return true;
    } catch (e) {
        console.warn(`⚠️ [ADB] 连接电视失败`);
        return false;
    }
}

export function castToTv(tvIp: string, adbPort: number, streamUrl: string, name: string): Promise<boolean> {
    return new Promise((resolve) => {
        console.log(`\n🚀 正在投送: [${name}] ...`);
        console.log(`🔗 流地址: ${streamUrl}`);

        // 1. 连接 ADB (以防万一)
        connectTv(tvIp, adbPort);

        // 2. 发送投屏指令 (使用最稳健的 -t video/* 策略，强制指定 -s 参数和 VLC 播放器)
        const target = `${tvIp}:${adbPort}`;
        const adbCmd = `adb -s ${target} shell am start -a android.intent.action.VIEW -d "${streamUrl}" -t "video/*" -p org.videolan.vlc`;

        exec(adbCmd, (err, stdout, stderr) => {
            if (err) {
                console.log(`❌ 发送失败: ${err.message}`);
                resolve(false);
            } else {
                console.log("✅ 直投指令已发送！");
                resolve(true);
            }
        });
    });
}

export function sendKeyToTv(tvIp: string, adbPort: number, keyCode: string): Promise<boolean> {
    return new Promise((resolve) => {
        // 确保连接
        connectTv(tvIp, adbPort);
        const target = `${tvIp}:${adbPort}`;
        const adbCmd = `adb -s ${target} shell input keyevent ${keyCode}`;
        exec(adbCmd, (err) => {
            if (err) {
                console.warn(`⚠️ [ADB] 发送按键 ${keyCode} 失败:`, err.message);
                resolve(false);
            } else {
                resolve(true);
            }
        });
    });
}

