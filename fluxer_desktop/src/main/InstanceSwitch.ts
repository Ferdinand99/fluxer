// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	getAppUrl,
	getDefaultAppUrl,
	getStoredInstanceUrl,
	normalizeInstanceUrl,
	setStoredInstanceUrl,
} from '@electron/common/DesktopConfig';
import {createChildLogger} from '@electron/common/Logger';
import {t} from '@electron/main/MainI18n';
import {relaunchAndExit} from '@electron/main/Troubleshooting';
import {getMainWindow, isTrustedOrigin} from '@electron/main/Window';
import {BrowserWindow, type IpcMainInvokeEvent, ipcMain} from 'electron';

const logger = createChildLogger('InstanceSwitch');

const INSTANCE_GET_CHANNEL = 'instance:get';
const INSTANCE_SET_CHANNEL = 'instance:set';
const PROMPT_SUBMIT_ORIGIN = 'https://instance-prompt.invalid';

export interface InstanceInfo {
	currentUrl: string;
	defaultUrl: string;
	isCustom: boolean;
}

function getInstanceInfo(): InstanceInfo {
	const storedUrl = getStoredInstanceUrl();
	return {
		currentUrl: new URL(getAppUrl()).origin,
		defaultUrl: new URL(getDefaultAppUrl()).origin,
		isCustom: storedUrl !== null,
	};
}

function isTrustedTopLevelSender(event: IpcMainInvokeEvent): boolean {
	const frame = event.senderFrame;
	if (frame == null) return false;
	try {
		if (frame.detached || frame.parent != null) return false;
		return isTrustedOrigin(frame.url);
	} catch {
		return false;
	}
}

export function applyInstanceUrl(url: string | null): boolean {
	const normalized = url === null ? null : normalizeInstanceUrl(url);
	if (url !== null && normalized === undefined) return false;
	const nextUrl = normalized ?? null;
	const previousUrl = getStoredInstanceUrl();
	if (nextUrl === previousUrl) return true;
	if (!setStoredInstanceUrl(nextUrl)) return false;
	logger.info('Instance changed; restarting', {from: previousUrl, to: nextUrl});
	relaunchAndExit();
	return true;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function buildPromptHtml(value: string, error: string | null): string {
	const isDefault = getStoredInstanceUrl() === null;
	return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; form-action ${PROMPT_SUBMIT_ORIGIN}">
<title>${escapeHtml(t('desktop.instance.promptTitle'))}</title>
<style>
	body { font: 14px system-ui, sans-serif; margin: 0; padding: 20px; background: #1e1f22; color: #f2f3f5; }
	label { display: block; font-weight: 600; margin-bottom: 8px; }
	input[type=text] { box-sizing: border-box; width: 100%; padding: 8px 10px; border-radius: 4px; border: 1px solid #3f4147; background: #2b2d31; color: inherit; font: inherit; }
	p { color: #b5bac1; margin: 8px 0 0; font-size: 12px; }
	p.error { color: #f23f42; }
	.actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
	button { padding: 8px 14px; border-radius: 4px; border: 0; font: inherit; cursor: pointer; background: #3f4147; color: inherit; }
	button.primary { background: #5865f2; }
	button:disabled { opacity: 0.5; cursor: default; }
</style>
</head>
<body>
<form method="get" action="${PROMPT_SUBMIT_ORIGIN}/set">
	<label for="url">${escapeHtml(t('desktop.instance.promptLabel'))}</label>
	<input id="url" name="url" type="text" value="${escapeHtml(value)}" placeholder="chat.example.com" autofocus spellcheck="false" autocomplete="off">
	${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
	<p>${escapeHtml(t('desktop.instance.promptHint'))}</p>
	<div class="actions">
		<button type="submit" name="action" value="reset"${isDefault ? ' disabled' : ''} formnovalidate>${escapeHtml(t('desktop.instance.useDefault'))}</button>
		<button type="submit" name="action" value="connect" class="primary">${escapeHtml(t('desktop.instance.promptConnect'))}</button>
	</div>
</form>
</body>
</html>`;
}

function loadPrompt(prompt: BrowserWindow, value: string, error: string | null): void {
	const html = buildPromptHtml(value, error);
	void prompt.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
}

let promptWindow: BrowserWindow | null = null;

export function openInstancePrompt(): void {
	if (promptWindow && !promptWindow.isDestroyed()) {
		promptWindow.focus();
		return;
	}
	const parent = getMainWindow();
	const prompt = new BrowserWindow({
		width: 440,
		height: 230,
		parent: parent && !parent.isDestroyed() ? parent : undefined,
		modal: Boolean(parent && !parent.isDestroyed()),
		resizable: false,
		minimizable: false,
		maximizable: false,
		autoHideMenuBar: true,
		title: t('desktop.instance.promptTitle'),
		webPreferences: {
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			webSecurity: true,
		},
	});
	promptWindow = prompt;
	prompt.removeMenu();
	prompt.on('closed', () => {
		if (promptWindow === prompt) promptWindow = null;
	});
	prompt.webContents.setWindowOpenHandler(() => ({action: 'deny'}));
	prompt.webContents.on('will-navigate', (event, url) => {
		if (url.startsWith('data:')) return;
		event.preventDefault();
		let parsed: URL;
		try {
			parsed = new URL(url);
		} catch {
			return;
		}
		if (parsed.origin !== PROMPT_SUBMIT_ORIGIN) return;
		if (parsed.searchParams.get('action') === 'reset') {
			prompt.close();
			applyInstanceUrl(null);
			return;
		}
		const input = parsed.searchParams.get('url') ?? '';
		const normalized = normalizeInstanceUrl(input);
		if (normalized === undefined) {
			loadPrompt(prompt, input, t('desktop.instance.promptInvalid'));
			return;
		}
		prompt.close();
		applyInstanceUrl(normalized);
	});
	loadPrompt(prompt, getStoredInstanceUrl() ?? '', null);
}

export function registerInstanceHandlers(): void {
	ipcMain.handle(INSTANCE_GET_CHANNEL, (event): InstanceInfo => {
		if (!isTrustedTopLevelSender(event)) {
			throw new Error(`${INSTANCE_GET_CHANNEL} is only reachable from the app document`);
		}
		return getInstanceInfo();
	});
	ipcMain.handle(INSTANCE_SET_CHANNEL, (event, url: unknown): void => {
		if (!isTrustedTopLevelSender(event)) {
			throw new Error(`${INSTANCE_SET_CHANNEL} is only reachable from the app document`);
		}
		if (url !== null && typeof url !== 'string') {
			throw new Error(`${INSTANCE_SET_CHANNEL} received an invalid URL`);
		}
		if (!applyInstanceUrl(url)) {
			throw new Error(`${INSTANCE_SET_CHANNEL} could not store the instance URL`);
		}
	});
}
