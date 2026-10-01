// SPDX-License-Identifier: AGPL-3.0-or-later

import {BUILD_CHANNEL} from '@electron/common/BuildChannel';

export const DESKTOP_APP_NAME = BUILD_CHANNEL === 'canary' ? 'Fluxins Canary' : 'Fluxins';
export const MACOS_BUNDLE_ID = BUILD_CHANNEL === 'canary' ? 'net.opland.fluxins.canary' : 'net.opland.fluxins';
export const LINUX_DESKTOP_ENTRY_ID = BUILD_CHANNEL === 'canary' ? 'fluxins-canary' : 'fluxins';
export const WINDOWS_SHORTCUT_AUTHOR = 'Opland';
export const WINDOWS_VELOPACK_ID = BUILD_CHANNEL === 'canary' ? 'fluxins_desktop_canary' : 'fluxins_desktop';
export const WINDOWS_LEGACY_SQUIRREL_ID = 'fluxins_app';
export const WINDOWS_APP_USER_MODEL_ID = BUILD_CHANNEL === 'canary' ? 'Opland.Fluxins.Canary' : 'Opland.Fluxins';
export const WINDOWS_LEGACY_APP_USER_MODEL_IDS = [`velopack.${WINDOWS_VELOPACK_ID}`];
export const WINDOWS_TOAST_ACTIVATOR_CLSID =
	BUILD_CHANNEL === 'canary' ? '{6B1F0C3A-7D52-4E9B-A8C4-5F2E91D3B7A0}' : '{C4A7E2D9-1B38-4F65-9E0A-83D5B6F1C2E7}';
