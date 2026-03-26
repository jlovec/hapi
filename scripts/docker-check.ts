#!/usr/bin/env bun

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';

// 该脚本校验的是 compose-smoke workflow 约定的 smoke 启动契约，
// 不是本地 docker-compose.yml 所有 environment 字段的完整消费面。
const repoRoot = dirname(import.meta.dir);
const composeFilePath = join(repoRoot, 'docker-compose.yml');
const envFilePath = join(repoRoot, '.env');

function ensureFileExists(filePath: string, description: string): void {
    if (!existsSync(filePath)) {
        throw new Error(`未找到${description}: ${filePath}`);
    }
}

function readEnvFile(filePath: string): Map<string, string> {
    const content = readFileSync(filePath, 'utf-8');
    const values = new Map<string, string>();

    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) {
            continue;
        }

        const separatorIndex = line.indexOf('=');
        if (separatorIndex <= 0) {
            continue;
        }

        const key = line.slice(0, separatorIndex).trim();
        const value = line.slice(separatorIndex + 1).trim();
        values.set(key, value);
    }

    return values;
}

function assertNonEmpty(values: Map<string, string>, key: string): void {
    const value = values.get(key);
    if (!value) {
        throw new Error(`.env 缺少必填项: ${key}`);
    }
}

function runComposeConfigCheck(): void {
    const result = spawnSync('docker', ['compose', '-f', composeFilePath, 'config', '--quiet'], {
        cwd: repoRoot,
        stdio: 'inherit',
        env: process.env
    });

    if (result.error) {
        throw new Error(`执行 docker compose config 失败: ${result.error.message}`);
    }

    if (result.status !== 0) {
        throw new Error(`docker compose config 校验失败，退出码: ${result.status ?? 'unknown'}`);
    }
}

async function main(): Promise<void> {
    ensureFileExists(composeFilePath, 'compose 文件');
    ensureFileExists(envFilePath, '.env 文件');

    const envValues = readEnvFile(envFilePath);
    assertNonEmpty(envValues, 'CLI_API_TOKEN');
    assertNonEmpty(envValues, 'ZS_API_URL');

    runComposeConfigCheck();
    console.log('✅ docker:check 通过');
}

if (import.meta.main) {
    main().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(message);
        process.exit(1);
    });
}
