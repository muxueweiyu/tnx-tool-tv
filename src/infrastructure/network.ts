import { networkInterfaces } from 'os';

export function getLocalIps(): string[] {
    const nets = networkInterfaces();
    const candidates: string[] = [];

    for (const name of Object.keys(nets)) {
        const interfaces = nets[name];
        if (!interfaces) continue;

        for (const net of interfaces) {
            if (net.family === 'IPv4' && !net.internal) {
                candidates.push(net.address);
            }
        }
    }
    return candidates;
}

export function getPreferredLanIp(tvIp?: string): string {
    const candidates = getLocalIps();

    // 过滤虚拟网卡和 VPN 常用的段
    const filtered = candidates.filter(ip => 
        !ip.startsWith('198.18.') && 
        !ip.startsWith('172.')
    );

    const finalIps = filtered.length > 0 ? filtered : candidates;

    // 优先匹配与电视在同一个网段的 IP (例如电视是 192.168.5.32，匹配 192.168.5.X)
    if (tvIp) {
        const tvSegment = tvIp.split('.').slice(0, 3).join('.');
        const bestMatch = finalIps.find(ip => ip.startsWith(tvSegment));
        if (bestMatch) return bestMatch;
    }

    // 否则根据权重排序：192.168.5.x (rain-118 基站网段优先) > 192.168.x.x > 10.x.x.x > 其他
    finalIps.sort((a, b) => {
        const score = (ip: string) => {
            if (ip.startsWith('192.168.5.')) return 3; // rain-118 基站网段优先
            if (ip.startsWith('192.168.')) return 2;
            if (ip.startsWith('10.')) return 1;
            return 0;
        };
        return score(b) - score(a);
    });

    return finalIps.length > 0 ? finalIps[0] : 'localhost';
}
