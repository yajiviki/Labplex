'use client';

import { useState } from 'react';
import { PasswordInput } from '../../../../components/PasswordInput';


export default function ChangePasswordPage() {
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmNewPassword, setConfirmNewPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setMessage(null);

		if (!currentPassword || !newPassword || !confirmNewPassword) {
			setError('All fields are required');
			return;
		}

		if (newPassword !== confirmNewPassword) {
			setError('New passwords do not match');
			return;
		}

		setLoading(true);
		try {
			const res = await fetch('/api/change-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ currentPassword, newPassword }),
			});

			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.error || 'Failed to update password');

			setMessage('Password updated successfully!');
			setCurrentPassword('');
			setNewPassword('');
			setConfirmNewPassword('');
		} catch (err: any) {
			setError(err.message || 'Failed to update password');
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="max-w-lg mx-auto py-10">
			<h1 className="text-2xl font-bold mb-6">Change Password</h1>

			<form onSubmit={handleSubmit} className="space-y-5">
				<PasswordInput
					label="Current Password"
					value={currentPassword}
					onChange={setCurrentPassword}
					name="currentPassword"
					autoComplete="current-password"
				/>

				<PasswordInput
					label="New Password"
					value={newPassword}
					onChange={setNewPassword}
					name="newPassword"
					autoComplete="new-password"
					placeholder="At least 8 characters"
				/>

				<PasswordInput
					label="Confirm New Password"
					value={confirmNewPassword}
					onChange={setConfirmNewPassword}
					name="confirmNewPassword"
					autoComplete="new-password"
				/>

				{error && <div className="text-sm text-red-600">{error}</div>}
				{message && <div className="text-sm text-green-600">{message}</div>}

				<button
					type="submit"
					disabled={loading}
					className="w-full bg-emerald-600 text-white py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
				>
					{loading ? 'Updating…' : 'Update Password'}
				</button>
			</form>
		</div>
	);
}
