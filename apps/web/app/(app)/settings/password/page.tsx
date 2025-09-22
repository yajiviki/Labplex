'use client';

import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

function PasswordInput({
	label,
	value,
	onChange,
	name,
	placeholder,
}: {
	label: string;
	value: string;
	onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	name: string;
	placeholder?: string;
}) {
	const [show, setShow] = useState(false);

	return (
		<div>
			<label className="block text-sm mb-1">{label}</label>
			<div className="relative">
				<input
					type={show ? 'text' : 'password'}
					name={name}
					value={value}
					onChange={onChange}
					placeholder={placeholder}
					className="w-full border rounded px-3 py-2 pr-10"
				/>
				<button
					type="button"
					onClick={() => setShow(!show)}
					className="absolute right-2 top-2.5 text-gray-500 hover:text-gray-700"
					aria-label={show ? 'Hide password' : 'Show password'}
				>
					{show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
				</button>
			</div>
		</div>
	);
}

export default function ChangePasswordPage() {
	const [currentPassword, setCurrentPassword] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');

	const [err, setErr] = useState<string | null>(null);
	const [ok, setOk] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setErr(null);
		setOk(null);

		if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
			return setErr('All fields are required.');
		}
		if (newPassword !== confirmPassword) {
			return setErr('New password and Confirm password do not match.');
		}
		if (newPassword.length < 6) {
			return setErr('New password must be at least 6 characters long.');
		}

		setLoading(true);
		try {
			const res = await fetch('/api/change-password', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ currentPassword, newPassword }),
			});

			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				setErr(data?.error || 'Failed to update password');
			} else {
				setOk('Password changed successfully. Please login again.');
				setCurrentPassword('');
				setNewPassword('');
				setConfirmPassword('');
			}
		} catch (e: any) {
			setErr(e?.message || 'Network error');
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="space-y-4">
			{/* Title bar */}
			<div className="rounded-xl border bg-white px-5 py-4 shadow-sm flex items-center gap-3">
				<div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand-600">
					<Lock className="h-5 w-5" />
				</div>
				<h1 className="text-2xl md:text-3xl font-bold tracking-tight">
					Change Password
				</h1>
			</div>

			{/* Form */}
			<div className="rounded-xl border bg-white p-4 shadow-sm max-w-lg">
				{err && <div className="mb-3 text-sm text-red-600">{err}</div>}
				{ok && <div className="mb-3 text-sm text-green-600">{ok}</div>}

				<form onSubmit={onSubmit} className="grid grid-cols-1 gap-4">
					<PasswordInput
						label="Current Password"
						name="currentPassword"
						value={currentPassword}
						onChange={(e) => setCurrentPassword(e.target.value)}
					/>

					<PasswordInput
						label="New Password"
						name="newPassword"
						value={newPassword}
						onChange={(e) => setNewPassword(e.target.value)}
					/>

					<PasswordInput
						label="Confirm New Password"
						name="confirmPassword"
						value={confirmPassword}
						onChange={(e) => setConfirmPassword(e.target.value)}
					/>

					<div className="flex gap-2 mt-2">
						<button
							type="submit"
							disabled={loading}
							className="rounded bg-brand text-white px-4 py-2 disabled:opacity-50"
						>
							{loading ? 'Updating…' : 'Update Password'}
						</button>
						<button
							type="button"
							onClick={() => {
								setCurrentPassword('');
								setNewPassword('');
								setConfirmPassword('');
								setErr(null);
								setOk(null);
							}}
							className="rounded border px-4 py-2"
						>
							Reset
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
