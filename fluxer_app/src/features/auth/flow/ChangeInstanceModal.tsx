// SPDX-License-Identifier: AGPL-3.0-or-later

import * as Modal from '@app/features/app/components/dialogs/Modal';
import {Button} from '@app/features/ui/button/Button';
import * as ModalCommands from '@app/features/ui/commands/ModalCommands';
import {modal} from '@app/features/ui/commands/ModalCommands';
import {Input} from '@app/features/ui/components/form/FormInput';
import {getElectronAPI} from '@app/features/ui/utils/NativeUtils';
import {msg} from '@lingui/core/macro';
import {Trans, useLingui} from '@lingui/react/macro';
import {observer} from 'mobx-react-lite';
import {type FormEvent, useCallback, useEffect, useState} from 'react';

export const CHANGE_INSTANCE_DESCRIPTOR = msg({
	message: 'Change instance',
	comment:
		'Link and modal title on the desktop sign-in screen that lets the user connect the app to a different self-hosted server.',
});
const INSTANCE_ADDRESS_DESCRIPTOR = msg({
	message: 'Instance address',
	comment:
		'Label for the text field where the user enters the address of the server the desktop app should connect to.',
});
const INVALID_INSTANCE_ADDRESS_DESCRIPTOR = msg({
	message: 'Enter a valid http or https address.',
	comment: 'Validation error shown when the instance address typed into the change instance modal cannot be parsed.',
});
const FAILED_TO_CHANGE_INSTANCE_DESCRIPTOR = msg({
	message: 'Could not change instance. Try again.',
	comment: 'Error shown when the desktop app fails to store the new instance address.',
});

function isValidInstanceAddress(value: string): boolean {
	const trimmed = value.trim();
	if (!trimmed) return false;
	try {
		const url = new URL(/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`);
		return (url.protocol === 'https:' || url.protocol === 'http:') && url.hostname.length > 0;
	} catch {
		return false;
	}
}

const ChangeInstanceModal = observer(() => {
	const {i18n} = useLingui();
	const instanceApi = getElectronAPI()?.instance;
	const [value, setValue] = useState('');
	const [defaultUrl, setDefaultUrl] = useState<string | null>(null);
	const [isCustom, setIsCustom] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);
	useEffect(() => {
		let cancelled = false;
		void instanceApi
			?.get()
			.then((info) => {
				if (cancelled) return;
				setDefaultUrl(info.defaultUrl);
				setIsCustom(info.isCustom);
				setValue(info.isCustom ? info.currentUrl : '');
			})
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [instanceApi]);
	const applyInstance = useCallback(
		async (url: string | null) => {
			if (!instanceApi) return;
			setIsSubmitting(true);
			setError(null);
			try {
				await instanceApi.set(url);
			} catch {
				setError(i18n._(FAILED_TO_CHANGE_INSTANCE_DESCRIPTOR));
				setIsSubmitting(false);
			}
		},
		[instanceApi, i18n],
	);
	const handleSubmit = useCallback(
		(event?: FormEvent) => {
			event?.preventDefault();
			if (!isValidInstanceAddress(value)) {
				setError(i18n._(INVALID_INSTANCE_ADDRESS_DESCRIPTOR));
				return;
			}
			void applyInstance(value.trim());
		},
		[value, applyInstance, i18n],
	);
	return (
		<Modal.Root size="small" centered onClose={ModalCommands.pop} data-flx="auth.flow.change-instance-modal.modal-root">
			<form onSubmit={handleSubmit} data-flx="auth.flow.change-instance-modal.form">
				<Modal.Header
					title={i18n._(CHANGE_INSTANCE_DESCRIPTOR)}
					data-flx="auth.flow.change-instance-modal.modal-header"
				/>
				<Modal.Content data-flx="auth.flow.change-instance-modal.modal-content">
					<Modal.ContentLayout data-flx="auth.flow.change-instance-modal.content-layout">
						<Modal.Description data-flx="auth.flow.change-instance-modal.description">
							<Trans>
								Enter the address of the server you want to connect to. The app restarts to apply the change.
							</Trans>
						</Modal.Description>
						<Modal.InputGroup data-flx="auth.flow.change-instance-modal.input-group">
							<Input
								data-flx="auth.flow.change-instance-modal.input.address"
								value={value}
								onChange={(event) => {
									setValue(event.target.value);
									setError(null);
								}}
								autoFocus={true}
								autoComplete="off"
								spellCheck={false}
								error={error ?? undefined}
								label={i18n._(INSTANCE_ADDRESS_DESCRIPTOR)}
								placeholder="chat.example.com"
								maxLength={256}
							/>
						</Modal.InputGroup>
					</Modal.ContentLayout>
				</Modal.Content>
				<Modal.Footer data-flx="auth.flow.change-instance-modal.modal-footer">
					<Button
						variant="secondary"
						onClick={ModalCommands.pop}
						disabled={isSubmitting}
						data-flx="auth.flow.change-instance-modal.button.cancel"
					>
						<Trans>Cancel</Trans>
					</Button>
					{isCustom ? (
						<Button
							variant="secondary"
							onClick={() => void applyInstance(null)}
							disabled={isSubmitting}
							data-flx="auth.flow.change-instance-modal.button.reset"
						>
							{defaultUrl ? <Trans>Use official instance</Trans> : <Trans>Reset</Trans>}
						</Button>
					) : null}
					<Button
						variant="primary"
						type="submit"
						submitting={isSubmitting}
						data-flx="auth.flow.change-instance-modal.button.connect"
					>
						<Trans>Connect</Trans>
					</Button>
				</Modal.Footer>
			</form>
		</Modal.Root>
	);
});

export function showChangeInstanceModal(): void {
	ModalCommands.push(modal(() => <ChangeInstanceModal data-flx="auth.flow.change-instance-modal.show.modal" />));
}

export default ChangeInstanceModal;
