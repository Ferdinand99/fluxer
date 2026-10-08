// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	isFluxinsVerifiedInstanceDomain,
	resolveFluxinsPinnedInstance,
} from '@app/features/auth/flow/instance_selector/FluxinsVerifiedInstances';
import type {InstanceInfo} from '@app/features/auth/flow/instance_selector/InstanceDirectoryStorage';
import {describe, expect, test} from 'vitest';

function knownInstance(domain: string): InstanceInfo {
	return {instanceKey: `known:${domain}`, domain, name: null, lastUsed: 1};
}

describe('isFluxinsVerifiedInstanceDomain', () => {
	test('the Opland instance is verified whatever the case or path', () => {
		expect(isFluxinsVerifiedInstanceDomain('fluxer.opland.net')).toBe(true);
		expect(isFluxinsVerifiedInstanceDomain('Fluxer.Opland.NET')).toBe(true);
		expect(isFluxinsVerifiedInstanceDomain('https://fluxer.opland.net/api')).toBe(true);
	});

	test('other hosts are not verified', () => {
		expect(isFluxinsVerifiedInstanceDomain('chat.example.com')).toBe(false);
		expect(isFluxinsVerifiedInstanceDomain('fluxer.opland.net.example.com')).toBe(false);
	});
});

describe('resolveFluxinsPinnedInstance', () => {
	test('a fresh install lists the verified instance as a fixed entry', () => {
		const pinned = resolveFluxinsPinnedInstance([]);

		expect(pinned?.domain).toBe('fluxer.opland.net');
		expect(pinned?.name).toBe('Opland Social');
	});

	test('nothing is pinned once the instance is already in the recent list', () => {
		expect(resolveFluxinsPinnedInstance([knownInstance('fluxer.opland.net')])).toBeNull();
	});

	test('other known instances do not hide the verified entry', () => {
		expect(resolveFluxinsPinnedInstance([knownInstance('chat.example.com')])?.domain).toBe('fluxer.opland.net');
	});
});
