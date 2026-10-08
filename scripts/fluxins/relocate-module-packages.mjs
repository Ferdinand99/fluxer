// SPDX-License-Identifier: AGPL-3.0-or-later

// Moves the desktop module packages out of the package-origin tree and into a flat directory that is
// attached to the GitHub release, then points every modules.json at the release assets.
//
// The package origin is a git branch, and git rejects files above 100 MB (the renderer module is
// larger). The client only needs the package URLs to be https, so the small modules.json files stay on
// the branch while the packages are downloaded from the release.
//
// Usage: node relocate-module-packages.mjs <payload-root> <channel> <out-dir> <release-download-base-url>

import {copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const [payloadRoot, channel, outDir, releaseBaseUrl] = process.argv.slice(2);
if (!payloadRoot || !channel || !outDir || !releaseBaseUrl) {
	console.error('Usage: relocate-module-packages.mjs <payload-root> <channel> <out-dir> <release-download-base-url>');
	process.exit(2);
}

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const channelDir = path.join(payloadRoot, channel);
const modulesDir = path.join(channelDir, 'modules');
const baseUrl = releaseBaseUrl.replace(/\/+$/u, '');

function childDirectories(dir) {
	return readdirSync(dir, {withFileTypes: true})
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort();
}

function assetNameFor(moduleName, sha256) {
	return `module-${moduleName}-${sha256.slice(0, 16)}.br`;
}

if (!existsSync(modulesDir)) {
	console.error(`No module packages found in ${modulesDir}`);
	process.exit(1);
}

mkdirSync(outDir, {recursive: true});

const assets = new Map();
for (const moduleName of childDirectories(modulesDir)) {
	for (const sha256 of childDirectories(path.join(modulesDir, moduleName))) {
		if (!SHA256_PATTERN.test(sha256)) {
			throw new Error(`Unexpected package directory ${moduleName}/${sha256}`);
		}
		const source = path.join(modulesDir, moduleName, sha256, 'package.br');
		if (!existsSync(source)) {
			throw new Error(`Missing ${source}`);
		}
		const assetName = assetNameFor(moduleName, sha256);
		copyFileSync(source, path.join(outDir, assetName));
		assets.set(`${moduleName}/${sha256}`, {assetName, bytes: statSync(source).size});
	}
}

let manifestCount = 0;
for (const platform of childDirectories(channelDir)) {
	if (platform === 'modules') continue;
	for (const arch of childDirectories(path.join(channelDir, platform))) {
		const manifestPath = path.join(channelDir, platform, arch, 'modules.json');
		if (!existsSync(manifestPath)) continue;
		const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
		for (const [moduleName, entry] of Object.entries(manifest.modules ?? {})) {
			const asset = assets.get(`${moduleName}/${entry.sha256}`);
			if (asset === undefined) {
				throw new Error(`${manifestPath}: no package for ${moduleName} at ${entry.sha256}`);
			}
			if (asset.bytes !== entry.bytes) {
				throw new Error(`${manifestPath}: ${moduleName} is ${asset.bytes} bytes, the manifest says ${entry.bytes}`);
			}
			entry.url = `${baseUrl}/${asset.assetName}`;
		}
		writeFileSync(manifestPath, `${JSON.stringify(manifest)}\n`);
		manifestCount += 1;
		console.log(`Rewrote ${manifestPath}`);
	}
}
if (manifestCount === 0) {
	throw new Error(`No modules.json found under ${channelDir}`);
}

rmSync(modulesDir, {recursive: true, force: true});

let totalBytes = 0;
for (const [key, asset] of assets) {
	totalBytes += asset.bytes;
	console.log(`${asset.assetName}  ${(asset.bytes / 1_000_000).toFixed(1)} MB  (${key.split('/')[0]})`);
}
console.log(`Moved ${assets.size} module package(s), ${(totalBytes / 1_000_000).toFixed(1)} MB, to ${outDir}`);
