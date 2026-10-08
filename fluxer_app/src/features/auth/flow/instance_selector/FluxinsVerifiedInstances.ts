// SPDX-License-Identifier: AGPL-3.0-or-later

import {
	type InstanceInfo,
	instanceDomainHost,
} from '@app/features/auth/flow/instance_selector/InstanceDirectoryStorage';

// Fluxins: instances shown with the verified badge in the instance picker next to the official Fluxer
// instance, and offered as a fixed entry so a fresh install already lists them.
export const FLUXINS_VERIFIED_INSTANCES: ReadonlyArray<{readonly domain: string; readonly name: string}> =
	Object.freeze([{domain: 'fluxer.opland.net', name: 'Opland Social'}]);

const FLUXINS_PINNED_INSTANCE_KEY_PREFIX = 'fluxins-verified:';

export function isFluxinsVerifiedInstanceDomain(domain: string): boolean {
	const host = instanceDomainHost(domain).toLowerCase();
	return FLUXINS_VERIFIED_INSTANCES.some((instance) => instance.domain === host);
}

export function resolveFluxinsPinnedInstance(knownInstances: ReadonlyArray<InstanceInfo>): InstanceInfo | null {
	for (const verified of FLUXINS_VERIFIED_INSTANCES) {
		const alreadyKnown = knownInstances.some(
			(instance) => instanceDomainHost(instance.domain).toLowerCase() === verified.domain,
		);
		if (!alreadyKnown) {
			return {
				instanceKey: `${FLUXINS_PINNED_INSTANCE_KEY_PREFIX}${verified.domain}`,
				domain: verified.domain,
				name: verified.name,
				lastUsed: 0,
			};
		}
	}
	return null;
}
