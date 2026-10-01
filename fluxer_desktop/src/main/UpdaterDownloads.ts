// SPDX-License-Identifier: AGPL-3.0-or-later

import {BUILD_CHANNEL} from '@electron/common/BuildChannel';
import {PROJECT_REPOSITORY_URL} from '@electron/common/Constants';

export type UpdaterDownloadOption = {
	format: ManualDesktopFormat;
	label: string;
	url: string;
	suggestedName?: string;
	sha256?: string | null;
};

type DesktopDownloadArch = 'x64' | 'arm64';

function getDesktopDownloadArch(arch: NodeJS.Architecture): DesktopDownloadArch {
	return arch === 'arm64' ? 'arm64' : 'x64';
}

const DESKTOP_DOWNLOAD_ARCH = getDesktopDownloadArch(process.arch);
const PKGS_BASE_URL = 'https://pkgs.fluxer.com';
export const UPDATE_BASE_URL = `${PKGS_BASE_URL}/desktop/${BUILD_CHANNEL}/${process.platform}/${DESKTOP_DOWNLOAD_ARCH}`;
export const DOWNLOAD_PAGE_URL = `${PROJECT_REPOSITORY_URL}/releases`;
// Velopack reads releases.win.json and the packages from the newest non-prerelease release.
export const VELOPACK_UPDATE_URL = `${PROJECT_REPOSITORY_URL}/releases/latest/download`;
export const GITHUB_LATEST_RELEASE_API_URL = `https://api.github.com/repos/${PROJECT_REPOSITORY_URL.replace(/^https:\/\/github\.com\//, '').replace(/\/$/, '')}/releases/latest`;
const RELEASE_TAG_PREFIX = 'fluxins-v';

export const MANUAL_DESKTOP_FORMATS = ['setup', 'dmg', 'zip', 'appimage', 'deb', 'rpm', 'tar_gz'] as const;

export type ManualDesktopFormat = (typeof MANUAL_DESKTOP_FORMATS)[number];
export type ManualLatestFile = {url: string; sha256: string | null};
type LinuxManualDesktopFormat = Extract<ManualDesktopFormat, 'appimage' | 'deb' | 'rpm' | 'tar_gz'>;

export type ManualLatestInfo = {
	version: string;
	pubDate: string | null;
	files: Partial<Record<ManualDesktopFormat, ManualLatestFile>>;
};

function getManualDownloadFormatPreference(): Array<ManualDesktopFormat> {
	if (process.platform === 'linux') {
		return ['appimage', 'deb', 'rpm', 'tar_gz'];
	}
	if (process.platform === 'darwin') {
		return ['dmg', 'zip'];
	}
	if (process.platform === 'win32') {
		return ['setup'];
	}
	return [];
}

const LINUX_MANUAL_FORMAT_LABELS: Record<LinuxManualDesktopFormat, string> = {
	appimage: 'AppImage',
	deb: 'DEB package',
	rpm: 'RPM package',
	tar_gz: 'tar.gz archive',
};

const LINUX_MANUAL_FORMAT_EXTENSIONS: Record<LinuxManualDesktopFormat, string> = {
	appimage: '.AppImage',
	deb: '.deb',
	rpm: '.rpm',
	tar_gz: '.tar.gz',
};

const LINUX_MANUAL_ARCH_TOKENS: Record<LinuxManualDesktopFormat, Record<DesktopDownloadArch, string>> = {
	appimage: {x64: 'x86_64', arm64: 'arm64'},
	deb: {x64: 'amd64', arm64: 'arm64'},
	rpm: {x64: 'x86_64', arm64: 'aarch64'},
	tar_gz: {x64: 'x64', arm64: 'arm64'},
};

function isLinuxManualDesktopFormat(format: ManualDesktopFormat): format is LinuxManualDesktopFormat {
	return format === 'appimage' || format === 'deb' || format === 'rpm' || format === 'tar_gz';
}

export function buildManualVersionDownloadUrl(version: string, format: ManualDesktopFormat): string {
	return `${UPDATE_BASE_URL}/${version}/${format}`;
}

function getArtifactProductName(): string {
	return BUILD_CHANNEL === 'canary' ? 'Fluxins-Canary' : 'Fluxins';
}

function getManualUpdateSuggestedName(format: LinuxManualDesktopFormat, version: string): string {
	const archToken = LINUX_MANUAL_ARCH_TOKENS[format][DESKTOP_DOWNLOAD_ARCH];
	const extension = LINUX_MANUAL_FORMAT_EXTENSIONS[format];
	return `${getArtifactProductName()}-${version}-linux-${archToken}${extension}`;
}

export function getManualDownloadOptions(info: ManualLatestInfo): Array<UpdaterDownloadOption> {
	if (process.platform !== 'linux') {
		return [];
	}
	return getManualDownloadFormatPreference()
		.filter(isLinuxManualDesktopFormat)
		.map((format) => {
			const file = info.files[format];
			return {
				format,
				label: LINUX_MANUAL_FORMAT_LABELS[format],
				url: buildManualVersionDownloadUrl(info.version, format),
				suggestedName: getManualUpdateSuggestedName(format, info.version),
				sha256: file?.sha256 ?? null,
			};
		});
}

// Reads the response of GET /repos/<owner>/<repo>/releases/latest. Releases are tagged
// fluxins-v<version> and carry Fluxins-<version>-win-<arch>-Setup.exe and
// Fluxins-<version>-mac-<arch>.dmg/.zip assets (see release-fluxins.yaml).
export function parseGithubLatestRelease(payload: unknown): ManualLatestInfo {
	if (payload === null || typeof payload !== 'object') {
		throw new Error('Latest release response is not an object');
	}
	const release = payload as {tag_name?: unknown; published_at?: unknown; assets?: unknown};
	if (typeof release.tag_name !== 'string' || release.tag_name.length === 0) {
		throw new Error('Latest release response missing tag name');
	}
	const version = release.tag_name.startsWith(RELEASE_TAG_PREFIX)
		? release.tag_name.slice(RELEASE_TAG_PREFIX.length)
		: release.tag_name.replace(/^v/, '');
	if (version.length === 0) {
		throw new Error('Latest release tag has no version');
	}
	const files: Partial<Record<ManualDesktopFormat, ManualLatestFile>> = {};
	if (Array.isArray(release.assets)) {
		for (const asset of release.assets) {
			if (asset === null || typeof asset !== 'object') continue;
			const {name, browser_download_url: url} = asset as {name?: unknown; browser_download_url?: unknown};
			if (typeof name !== 'string' || typeof url !== 'string' || url.length === 0) continue;
			if (process.platform === 'win32' && name.endsWith(`-win-${DESKTOP_DOWNLOAD_ARCH}-Setup.exe`)) {
				files.setup = {url, sha256: null};
			} else if (process.platform === 'darwin' && name.endsWith(`-mac-${DESKTOP_DOWNLOAD_ARCH}.dmg`)) {
				files.dmg = {url, sha256: null};
			} else if (process.platform === 'darwin' && name.endsWith(`-mac-${DESKTOP_DOWNLOAD_ARCH}.zip`)) {
				files.zip = {url, sha256: null};
			}
		}
	}
	return {
		version,
		pubDate: typeof release.published_at === 'string' ? release.published_at : null,
		files,
	};
}

export function getManualDownloadUrl(info: ManualLatestInfo): string {
	const [preferredOption] = getManualDownloadOptions(info);
	if (preferredOption) {
		return preferredOption.url;
	}
	for (const format of getManualDownloadFormatPreference()) {
		const url = info.files[format]?.url;
		if (url) {
			return url;
		}
	}
	return DOWNLOAD_PAGE_URL;
}
