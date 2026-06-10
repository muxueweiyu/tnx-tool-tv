import { StreamState } from '../core/models/channel.js';

export function findBoxOffset(buffer: Buffer, path: string[], startOffset: number = 0): number {
    let currentOffset = startOffset;
    for (let i = 0; i < path.length; i++) {
        const targetType = path[i];
        let found = false;
        while (currentOffset < buffer.length - 8) {
            const size = buffer.readUInt32BE(currentOffset);
            const boxType = buffer.toString('ascii', currentOffset + 4, currentOffset + 8);
            if (boxType === targetType) {
                if (i === path.length - 1) {
                    return currentOffset;
                }
                currentOffset += 8; // Enter container box
                found = true;
                break;
            }
            if (size <= 8) break;
            currentOffset += size;
        }
        if (!found) return -1;
    }
    return -1;
}

export function processTfdt(buffer: Buffer, newTime?: number | bigint): number | null {
    const offset = findBoxOffset(buffer, ['moof', 'traf', 'tfdt']);
    if (offset === -1) return null;
    
    const version = buffer.readUInt8(offset + 8);
    const timeOffset = offset + 12;
    
    let oldTime: number | bigint;
    if (version === 0) {
        if (timeOffset + 4 > buffer.length) return null;
        oldTime = buffer.readUInt32BE(timeOffset);
        if (newTime !== undefined) {
            buffer.writeUInt32BE(Number(newTime), timeOffset);
        }
    } else if (version === 1) {
        if (timeOffset + 8 > buffer.length) return null;
        oldTime = buffer.readBigUInt64BE(timeOffset);
        if (newTime !== undefined) {
            buffer.writeBigUInt64BE(BigInt(newTime), timeOffset);
        }
        oldTime = Number(oldTime);
    } else {
        return null;
    }
    return Number(oldTime);
}

export function getTrunDuration(buffer: Buffer): number {
    const offset = findBoxOffset(buffer, ['moof', 'traf', 'trun']);
    if (offset === -1) return 0;
    
    const flags = buffer.readUInt32BE(offset + 8) & 0x00FFFFFF;
    const sampleCount = buffer.readUInt32BE(offset + 12);
    
    let currentOffset = offset + 16;
    if (flags & 0x000001) currentOffset += 4;
    if (flags & 0x000004) currentOffset += 4;
    
    let totalDuration = 0;
    const hasDuration = flags & 0x000100;
    const hasSize = flags & 0x000200;
    const hasFlags = flags & 0x000400;
    const hasCompOffset = flags & 0x000800;
    
    let entrySize = 0;
    if (hasDuration) entrySize += 4;
    if (hasSize) entrySize += 4;
    if (hasFlags) entrySize += 4;
    if (hasCompOffset) entrySize += 4;
    
    if (hasDuration) {
        for (let i = 0; i < sampleCount; i++) {
            if (currentOffset + (i + 1) * entrySize <= buffer.length) {
                totalDuration += buffer.readUInt32BE(currentOffset + i * entrySize);
            }
        }
    } else {
        const tfhdOffset = findBoxOffset(buffer, ['moof', 'traf', 'tfhd']);
        if (tfhdOffset !== -1) {
            const tfhdFlags = buffer.readUInt32BE(tfhdOffset + 8) & 0x00FFFFFF;
            if (tfhdFlags & 0x000020) {
                let tfhdPayloadOffset = tfhdOffset + 16;
                if (tfhdFlags & 0x000001) tfhdPayloadOffset += 8;
                if (tfhdFlags & 0x000002) tfhdPayloadOffset += 4;
                if (tfhdPayloadOffset + 4 <= buffer.length) {
                    const defaultDuration = buffer.readUInt32BE(tfhdPayloadOffset);
                    totalDuration = defaultDuration * sampleCount;
                }
            }
        }
    }
    return totalDuration;
}

export function getTimescale(headerBuffer: Buffer): number | null {
    const offset = findBoxOffset(headerBuffer, ['moov', 'trak', 'mdia', 'mdhd']);
    if (offset === -1) return null;
    
    const version = headerBuffer.readUInt8(offset + 8);
    let timescaleOffset = offset + 12;
    if (version === 0) {
        timescaleOffset += 8;
    } else if (version === 1) {
        timescaleOffset += 16;
    }
    if (timescaleOffset + 4 <= headerBuffer.length) {
        return headerBuffer.readUInt32BE(timescaleOffset);
    }
    return null;
}

export function cleanAndSyncFragment(chunk: Buffer, type: 'video' | 'audio', streamState: StreamState, pid: string): Buffer {
    try {
        const track = streamState.tracks[type];
        const rawDts = processTfdt(chunk);
        if (rawDts === null) return chunk;

        const dur = getTrunDuration(chunk);
        const currentTimescale = track.timescale;

        if (streamState.streamStartOrigTime === null) {
            streamState.streamStartOrigTime = rawDts / currentTimescale;
        }

        const wOrig = (rawDts / currentTimescale) - streamState.streamStartOrigTime;
        const wMin = track.lastOutDtsEnd !== null ? (track.lastOutDtsEnd / currentTimescale) : wOrig;
        const wNew = Math.max(0, Math.max(wOrig, wMin));

        const newDts = Math.round(wNew * currentTimescale);
        processTfdt(chunk, newDts);

        track.lastOutDtsEnd = newDts + dur;
        return chunk;
    } catch (e: any) {
        console.error(`❌ [Muxer] [${pid}] 处理 ${type} 分片出错:`, e.message || e);
        return chunk;
    }
}
