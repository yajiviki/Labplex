'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, Search } from 'lucide-react';

type UserRow = {
	id: string;
	name: string | null;
	phone: string | null;
	userType: string | null; // PATIENT | STAFF | OTHER
	role: string;            // ADMIN | STAFF | USER
	dob: string | null;      // ISO string
	address: string | null;
	email: string | null;
	employeeId: string | null;
	createdAt: string;       // ISO
};

type SortKey = keyof Pick<
	UserRow,
	'name' | 'phone' | 'userType' | 'role' | 'dob' | 'email' | 'employeeId' | 'createdAt'
>;
type SortDir = 'asc' | 'desc';

export default function UserManagementPage() {
	const [rows, setRows] = useState<UserRow[]>([]);
	const [loading, setLoading] = useState(false);

	// Form state
	const [editingId, setEditingId] = useState<string | null>(null);
	const [name, setName] = useState('');
	const [dob, setDob] = useState<string>(''); // yyyy-mm-dd
	const [address, setAddress] = useState('');
	const [phone, setPhone] = useState('');
	const [userType, setUserType] = useState<'PATIENT' | 'STAFF' | 'OTHER' | ''>('');
	const [role, setRole] = useState<'ADMIN' | 'STAFF' | 'USER' | ''>('');
	const [email, setEmail] = useState('');
	const [employeeId, setEmployeeId] = useState('');

	// UI helpers
	const [err, setErr] = useState<string | null>(null);
	const [ok, setOk] = useState<string | null>(null);

	// Sorting + search
	const [sortKey, setSortKey] = useState<SortKey>('createdAt');
	const [sortDir, setSortDir] = useState<SortDir>('desc');
	const [q, setQ] = useState('');

	async function load() {
		setLoading(true);
		setErr(null);
		try {
			const res = await fetch('/api/users', { cache: 'no-store' });
			if (!res.ok) {
				const txt = await res.text();
				setErr(`Load failed: ${txt || res.status}`);
				setRows([]);
			} else {
				let data: any = [];
				try {
					data = await res.json();
				} catch {
					const txt = await res.text();
					setErr(`Bad JSON: ${txt?.slice(0, 200)}`);
					data = [];
				}
				setRows(Array.isArray(data) ? data : []);
			}
		} catch (e: any) {
			setErr(e?.message || 'Network error');
			setRows([]);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		load();
	}, []);

	function resetForm() {
		setEditingId(null);
		setName('');
		setDob('');
		setAddress('');
		setPhone('');
		setUserType('');
		setRole('');
		setEmail('');
		setEmployeeId('');
		setErr(null);
		setOk(null);
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setErr(null);
		setOk(null);

		// Validation
		if (!name.trim() || !phone.trim() || !userType || !role) {
			setErr('Please fill Name, Mobile, User Type and Role.');
			return;
		}

		const payload = {
			name: name.trim(),
			phone: phone.trim(),
			userType,
			role,
			dob: dob ? new Date(dob).toISOString() : null,
			address: address.trim() || null,
			email: email.trim() || null,
			employeeId: employeeId.trim() || null,
		};

		try {
			const res = await fetch(editingId ? `/api/users/${editingId}` : '/api/users', {
				method: editingId ? 'PUT' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});

			let data: any = null;
			try {
				data = await res.json();
			} catch {
				const txt = await res.text();
				if (!res.ok) {
					setErr(txt || 'Save failed');
					return;
				}
				setOk('Saved.');
				await load();
				return;
			}

			if (!res.ok) {
				setErr(data?.error || 'Save failed');
				return;
			}

			setOk(editingId ? 'Updated!' : 'Created!');
			await load();
			// Keep editing state so user can continue editing, or call resetForm() if you prefer.
			// resetForm();
		} catch (e: any) {
			setErr(e?.message || 'Network error');
		}
	}

	function startEdit(u: UserRow) {
		setEditingId(u.id);
		setName(u.name || '');
		setDob(u.dob ? u.dob.slice(0, 10) : ''); // yyyy-mm-dd
		setAddress(u.address || '');
		setPhone(u.phone || '');
		setUserType(((u.userType || '') as any) || '');
		setRole(((u.role || '') as any) || '');
		setEmail(u.email || '');
		setEmployeeId(u.employeeId || '');
		setErr(null);
		setOk(null);
	}

	function sortBy(key: SortKey) {
		if (key === sortKey) {
			setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
		} else {
			setSortKey(key);
			setSortDir('asc');
		}
	}

	const filtered = useMemo(() => {
		const term = q.trim().toLowerCase();
		const base = term
			? rows.filter((r) =>
				[r.name, r.phone, r.userType, r.role, r.email, r.employeeId, r.address]
					.filter(Boolean)
					.some((v) => String(v).toLowerCase().includes(term))
			)
			: rows;

		const sorted = [...base].sort((a, b) => {
			const va = (a[sortKey] ?? '') as any;
			const vb = (b[sortKey] ?? '') as any;
			if (va === vb) return 0;
			if (sortDir === 'asc') return va > vb ? 1 : -1;
			return va < vb ? 1 : -1;
		});

		return sorted;
	}, [rows, q, sortKey, sortDir]);

	const Col = ({ k, label }: { k: SortKey; label: string }) => {
		const active = sortKey === k;
		return (
			<th
				className="px-3 py-2 text-left text-sm font-semibold text-gray-700 cursor-pointer select-none"
				onClick={() => sortBy(k)}
			>
				<div className="inline-flex items-center gap-1">
					<span>{label}</span>
					{active ? (sortDir === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : null}
				</div>
			</th>
		);
	};

	return (
		<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
			{/* Form */}
			<div className="rounded-xl border bg-white p-4 shadow-sm">
				<div className="flex items-center justify-between mb-3">
					<h2 className="text-base font-semibold">{editingId ? 'Update User' : 'Add New User'}</h2>
					<button onClick={resetForm} className="text-sm text-gray-600 hover:underline">
						Clear
					</button>
				</div>

				{err && <div className="mb-3 text-sm text-red-600">{err}</div>}
				{ok && <div className="mb-3 text-sm text-green-600">{ok}</div>}

				<form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
					<div>
						<label className="block text-sm mb-1">Name *</label>
						<input className="w-full border rounded px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
					</div>

					<div>
						<label className="block text-sm mb-1">DOB</label>
						<input type="date" className="w-full border rounded px-3 py-2" value={dob} onChange={(e) => setDob(e.target.value)} />
					</div>

					<div className="md:col-span-2">
						<label className="block text-sm mb-1">Address</label>
						<input className="w-full border rounded px-3 py-2" value={address} onChange={(e) => setAddress(e.target.value)} />
					</div>

					<div>
						<label className="block text-sm mb-1">Mobile *</label>
						<input className="w-full border rounded px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
					</div>

					<div>
						<label className="block text-sm mb-1">User Type *</label>
						<select className="w-full border rounded px-3 py-2" value={userType} onChange={(e) => setUserType(e.target.value as any)}>
							<option value="">Select…</option>
							<option value="PATIENT">Patient</option>
							<option value="STAFF">Staff</option>
							<option value="OTHER">Other</option>
						</select>
					</div>

					<div>
						<label className="block text-sm mb-1">Role *</label>
						<select className="w-full border rounded px-3 py-2" value={role} onChange={(e) => setRole(e.target.value as any)}>
							<option value="">Select…</option>
							<option value="ADMIN">Admin</option>
							<option value="STAFF">Staff</option>
							<option value="USER">User</option>
						</select>
					</div>

					<div>
						<label className="block text-sm mb-1">Email (optional)</label>
						<input
							type="email"
							className="w-full border rounded px-3 py-2"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
						/>
					</div>

					<div>
						<label className="block text-sm mb-1">User ID (optional)</label>
						<input className="w-full border rounded px-3 py-2" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
					</div>

					<div className="md:col-span-2 flex gap-2 mt-1">
						<button className="rounded bg-brand text-white px-4 py-2">{editingId ? 'Update' : 'Create'}</button>
						<button type="button" className="rounded border px-4 py-2" onClick={resetForm}>
							Reset
						</button>
					</div>
				</form>
			</div>

			{/* Table */}
			<div className="rounded-xl border bg-white p-4 shadow-sm w-auto">
				<div className="flex items-center justify-between mb-3">
					<h2 className="text-base font-semibold">Users Management</h2>
					<div className="relative">
						<Search className="h-4 w-4 absolute left-2 top-2.5 text-gray-400" />
						<input
							placeholder="Search…"
							className="pl-8 pr-3 py-2 border rounded w-64"
							value={q}
							onChange={(e) => setQ(e.target.value)}
						/>
					</div>
				</div>

				<div className="overflow-x-auto">
					<table className="min-w-full border rounded">
						<thead className="bg-gray-50">
							<tr>
								<Col k="name" label="Name" />
								<Col k="phone" label="Mobile" />
								<Col k="userType" label="User Type" />
								<Col k="role" label="Role" />
								<Col k="email" label="Email" />
								<Col k="employeeId" label="User ID" />
								<Col k="createdAt" label="Created" />
							</tr>
						</thead>
						<tbody>
							{loading ? (
								<tr>
									<td colSpan={7} className="px-3 py-4 text-center text-sm text-gray-500">
										Loading…
									</td>
								</tr>
							) : filtered.length === 0 ? (
								<tr>
									<td colSpan={7} className="px-3 py-4 text-center text-sm text-gray-500">
										No users found
									</td>
								</tr>
							) : (
								filtered.map((u) => (
									<tr
										key={u.id}
										className="border-t hover:bg-gray-50 cursor-pointer"
										onClick={() => startEdit(u)}
										title="Click to edit"
									>
										<td className="px-3 py-2 text-sm">{u.name}</td>
										<td className="px-3 py-2 text-sm">{u.phone}</td>
										<td className="px-3 py-2 text-sm">{u.userType}</td>
										<td className="px-3 py-2 text-sm">{u.role}</td>
										<td className="px-3 py-2 text-sm">{u.email}</td>
										<td className="px-3 py-2 text-sm">{u.employeeId}</td>
										<td className="px-3 py-2 text-sm">{new Date(u.createdAt).toLocaleDateString()}</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
