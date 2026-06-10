#!/usr/bin/env node

/**
 * tnx-cli entrypoint
 * 
 * 按照 00-global.md 规定，此文件仅用于拦截初始化配置和路由导向。
 * 绝对不应包含具体某个命令的业务逻辑！！！
 */

import { Command } from 'commander';
import { runGatewayCommand } from './commands/gateway-cmd.js';
import { runRemoteCommand } from './commands/remote-cmd.js';

const program = new Command();

program
    .name('tnx-tv')
    .description('Industrial Grade YSP Decoding Gateway & TV Caster CLI')
    .version('1.0.0');

program
    .command('start')
    .description('Start the CognitiveTV decryption gateway server')
    .option('-p, --player <type>', 'Autostart local player (lite, lazy, standard, none)')
    .action(async (options) => {
        try {
            await runGatewayCommand(options);
        } catch (err: any) {
            console.error("💥 Gateway execution error:", err.message || err);
        }
    });

program
    .command('remote')
    .description('Launch the TV remote control and ADB caster')
    .option('-t, --tv-ip <ip>', 'Override default target TV IP')
    .action((options) => {
        try {
            runRemoteCommand(options);
        } catch (err: any) {
            console.error("💥 Remote caster execution error:", err.message || err);
        }
    });

// 默认情况下若未匹配到命令则打印帮助
program.action(() => {
    console.log("📺 Welcome to tnx-tv!");
    program.help();
});

program.parse(process.argv);
export {};
