/**
 * Download tunwg binaries
 *
 * Downloads pre-built tunwg binaries from GitHub releases.
 * Output directory: hub/tools/tunwg/
 *
 * Environment Variables:
 * - TUNWG_TARGET_PLATFORM: Only download specific platform (e.g., "x64-linux")
 *                          If not set, downloads all platforms
 */

import { existsSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';

const TUNWG_RELEASES: Record<string, string> = {
    'x64-linux': 'https://github.com/tiann/tunwg/releases/latest/download/tunwg',
    'arm64-linux': 'https://github.com/tiann/tunwg/releases/latest/download/tunwg-arm64',
    'x64-darwin': 'https://github.com/tiann/tunwg/releases/latest/download/tunwg-darwin',
    'arm64-darwin': 'https://github.com/tiann/tunwg/releases/latest/download/tunwg-darwin-arm64',
    'x64-win32': 'https://github.com/tiann/tunwg/releases/latest/download/tunwg.exe'
};

const LICENSE_URL = 'https://raw.githubusercontent.com/tiann/tunwg/refs/heads/main/LICENSE';

async function downloadFile(url: string, destPath: string): Promise<void> {
    console.log(`Downloading ${url}...`);

    const response = await fetch(url, { redirect: 'follow' });
    if (!response.ok) {
        throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    mkdirSync(dirname(destPath), { recursive: true });
    writeFileSync(destPath, Buffer.from(buffer));

    console.log(`  -> ${destPath} (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);
}

async function main(): Promise<void> {
    const scriptDir = dirname(new URL(import.meta.url).pathname);
    const toolsDir = join(scriptDir, '..', 'tools', 'tunwg');

    // Check if we should only download a specific platform
    const targetPlatform = process.env.TUNWG_TARGET_PLATFORM;
    const platformsToDownload = targetPlatform
        ? { [targetPlatform]: TUNWG_RELEASES[targetPlatform] }
        : TUNWG_RELEASES;

    if (targetPlatform) {
        if (!TUNWG_RELEASES[targetPlatform]) {
            console.error(`Error: Unknown platform "${targetPlatform}"`);
            console.error(`Available platforms: ${Object.keys(TUNWG_RELEASES).join(', ')}`);
            process.exit(1);
        }
        console.log(`Downloading tunwg binary for platform: ${targetPlatform}\n`);
    } else {
        console.log('Downloading tunwg binaries for all platforms...\n');
    }

    // Download platform binaries
    for (const [platform, url] of Object.entries(platformsToDownload)) {
        const filename = `tunwg-${platform}${platform.includes('win32') ? '.exe' : ''}`;
        const destPath = join(toolsDir, filename);

        if (existsSync(destPath)) {
            console.log(`Skipping ${filename} (already exists)`);
            continue;
        }

        try {
            await downloadFile(url, destPath);

            // Make executable on Unix
            if (!platform.includes('win32')) {
                chmodSync(destPath, 0o755);
            }
        } catch (error) {
            // If downloading a specific platform, fail fast
            if (targetPlatform) {
                throw error;
            }
            // If downloading all platforms, warn but continue
            console.error(`Warning: Failed to download ${filename}:`, error);
        }
    }

    // Download LICENSE
    const licensePath = join(toolsDir, 'LICENSE');
    if (!existsSync(licensePath)) {
        try {
            await downloadFile(LICENSE_URL, licensePath);
        } catch (error) {
            console.error('Warning: Failed to download LICENSE:', error);
        }
    } else {
        console.log('Skipping LICENSE (already exists)');
    }

    console.log('\nDone!');
}

main().catch((error) => {
    console.error('Error:', error);
    process.exit(1);
});
