// SPDX-License-Identifier: AGPL-3.0-or-later

export const APP_PROTOCOL = 'fluxins';
export const STABLE_APP_URL = 'https://fluxer.opland.net';
export const CANARY_APP_URL = 'https://fluxer.opland.net';
export const STABLE_MIGRATED_APP_ORIGIN = 'https://fluxer.com';
export const CANARY_MIGRATED_APP_ORIGIN = 'https://canary.fluxer.com';
export const MIGRATED_APP_ENTRY_PATH = '/app';
export const PASSKEY_RP_IDS = ['fluxer.app', 'fluxer.com'] as const;
export const PROJECT_REPOSITORY_URL = 'https://github.com/Ferdinand99/fluxer';
// Platforms that update themselves from the fork's GitHub releases. macOS builds are ad-hoc signed
// and cannot self-update; Linux is not built by the release workflow.
export const IN_APP_UPDATE_PLATFORMS: ReadonlyArray<NodeJS.Platform> = ['win32'];
// Where the notify-only updater (macOS, portable builds) looks for the newest version.
export const MANUAL_UPDATE_FEED: 'github' | 'pkgs' = 'github';
export const STATIC_CDN_URL = 'https://fluxerstatic.com';
export const DEFAULT_WINDOW_WIDTH = 1280;
export const DEFAULT_WINDOW_HEIGHT = 800;
export const MIN_WINDOW_WIDTH = 800;
export const MIN_WINDOW_HEIGHT = 600;
