'use client';

import { useState } from 'react';
import { KeyRound } from 'lucide-react';

export default function SecurityPage() {
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirm, setConfirm] = useState('');
	const [err, setErr] = useState<string | null>(null);
	const [ok, setOk] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setErr(null); setOk(null);
		if (!currentPassword || !newPassword || !confirm) return setErr('All fields are required.');
		if (newPassword !== confirm) return setErr('Passwords do not match.');
		if (newPassword.length < 8) return setErr('New password must be at least 8 characters.');
		setLoading(true);
		try {
			const res = await fetch('/api/auth/change-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ currentPassword, newPassword }),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) return setErr(data?.error || 'Failed to change password');
			setOk('Password changed successfully.');
			setCurrentPassword(''); setNewPassword(''); setConfirm('');
		} catch (e: any) {
			setErr(e?.message || 'Network error');
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="space-y-4">
			<div className="rounded-xl border bg-white px-5 py-4 shadow-sm flex items-center gap-3">
				<div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand-600">
					<KeyRound className="h-5 w-5" />
				</div>
				<h1 className="text-2xl md:text-3xl font-bold tracking-tight">Change Password</h1>
			</div>

			<div className="rounded-xl border bg-white p-4 shadow-sm max-w-xl">
				{err && <div className="mb-3 text-sm text-red-600">{err}</div>}
				{ok && <div className="mb-3 text-sm text-green-600">{ok}</div>}

				<form onSubmit={onSubmit} className="space-y-3">
					<div>
						<label className="block text-sm mb-1">Current password</label>
						<input type="password" className="w-full border rounded px-3 py-2" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
					</div>
					<div>
						<label className="block text-sm mb-1">New password</label>
						<input type="password" className="w-full border rounded px-3 py-2" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
					</div>
					<div>
						<label className="block text-sm mb-1">Confirm new password</label>
						<input type="password" className="w-full border rounded px-3 py-2" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
					</div>
					<button className="rounded bg-brand text-white px-4 py-2" disabled={loading}>
						{loading ? 'Saving…' : 'Save'}
					</button>
				</form>
			</div>
		</div>
	);
}
