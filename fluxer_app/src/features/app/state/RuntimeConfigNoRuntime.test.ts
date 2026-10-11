// SPDX-License-Identifier: AGPL-3.0-or-later

import {configure} from 'mobx';
import {beforeEach, describe, expect, test, vi} from 'vitest';

describe('RuntimeConfig before any instance is active', () => {
	beforeEach(() => {
		vi.resetModules();
		configure({disableErrorBoundaries: true, enforceActions: 'never'});
	});

	test('isSelfHosted reports false instead of throwing', async () => {
		const {default: RuntimeConfig} = await import('@app/features/app/state/RuntimeConfig');
		expect(RuntimeConfig.getSnapshotOrNull()).toBeNull();
		expect(RuntimeConfig.isSelfHosted()).toBe(false);
	});

	test('repeated reads stay stable', async () => {
		const {default: RuntimeConfig} = await import('@app/features/app/state/RuntimeConfig');
		expect(RuntimeConfig.isSelfHosted()).toBe(false);
		expect(RuntimeConfig.isSelfHosted()).toBe(false);
	});
});
