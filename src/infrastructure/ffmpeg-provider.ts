import { spawn, ChildProcess } from 'child_process';
import { Writable } from 'stream';

const noop = () => {};

export function safeWrite(stream: Writable | null | undefined, chunk: Buffer): boolean {
    if (stream && !stream.destroyed && stream.writable) {
        try {
            stream.write(chunk);
            return true;
        } catch (e) {
            return false;
        }
    }
    return false;
}

export function spawnFFmpeg(ffmpegPath: string, pid: string): ChildProcess {
    console.log(`🚀 [FFmpeg] [${pid}] 启动无损拷贝封装引擎`);

    const inputArgs = [
        '-y', '-hide_banner', '-loglevel', 'error',
        '-err_detect', 'ignore_err',
        '-fflags', '+genpts+igndts+discardcorrupt',
        '-ignore_editlist', '1',
        '-probesize', '5000000', 
        '-thread_queue_size', '8192', '-f', 'mp4', '-i', 'pipe:0', 
        '-thread_queue_size', '8192', '-f', 'mp4', '-i', 'pipe:3', 
        '-map', '0:v', '-map', '1:a'
    ];

    const outputArgs = [
        '-c:v', 'copy'
    ];

    const audioArgs = [
        '-c:a', 'copy',
        '-f', 'mpegts', 
        '-avoid_negative_ts', 'make_zero',
        '-muxdelay', '0.1',
        'pipe:1'
    ];

    const child = spawn(ffmpegPath, [...inputArgs, ...outputArgs, ...audioArgs], {
        stdio: ['pipe', 'pipe', 'inherit', 'pipe'],
        shell: process.platform === 'win32' && !ffmpegPath.toLowerCase().endsWith('.exe')
    });

    child.stdin?.on('error', noop);
    child.stdio[3]?.on('error', noop);

    return child;
}
