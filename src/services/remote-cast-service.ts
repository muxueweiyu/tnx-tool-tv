import { connectTv, castToTv } from '../infrastructure/adb-client.js';
import { AppConfig } from '../core/models/config.js';

export class RemoteCastService {
    private config: AppConfig;

    constructor(config: AppConfig) {
        this.config = config;
    }

    async castChannel(url: string, name: string, customTvIp?: string): Promise<boolean> {
        const tvIp = customTvIp || this.config.tvIp;
        const adbPort = this.config.adbPort;
        return await castToTv(tvIp, adbPort, url, name);
    }

    connect(customTvIp?: string): boolean {
        const tvIp = customTvIp || this.config.tvIp;
        const adbPort = this.config.adbPort;
        return connectTv(tvIp, adbPort);
    }
}
