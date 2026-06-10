import { Readable, PassThrough } from 'stream';

export interface ChannelInfo {
    name: string;
    url: string;
    pid: string;
}

export interface TrackData {
    id: number | null;
    header: Buffer | null;
    buffer: Buffer[];
}

export interface TrackMap {
    video: TrackData;
    audio: TrackData;
}

export interface TrackState {
    lastOutDtsEnd: number | null;
    timescale: number;
}

export interface StreamState {
    streamStartOrigTime: number | null;
    tracks: {
        video: TrackState;
        audio: TrackState;
    };
}

export interface ChannelStatus {
    pid: string;
    viewers: number;
    hasPage: boolean;
    hasFfmpeg: boolean;
    lastDataTime: number;
}
