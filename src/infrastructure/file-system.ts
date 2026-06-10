import fs from 'fs';

export function readTextFile(filePath: string): string {
    return fs.readFileSync(filePath, 'utf-8');
}

export function writeTextFile(filePath: string, content: string): void {
    fs.writeFileSync(filePath, content, 'utf-8');
}

export function fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
}
