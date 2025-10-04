'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronUp, ChevronDown, Search, Trash2, Users as UsersIcon, Copy, CheckCircle2, Eye, EyeOff, X } from 'lucide-react';

type UserRow = {
	id: string;
	name: string | null;
	phone: string | null;
	role: 'USER' | 'ADMIN' | 'SUPER_ADMIN' | string;
	dob: string | null;
	address: string | null;
	employeeId: string | null; // mapped from backend userId
	createdAt: string;
	lab?: { labCode: string; name: string } | null;
};

type LabRow = { labCode: string; name: string };

type SortKey = keyof Pick<UserRow, 'employeeId' | 'name' | 'phone' | 'role' | 'createdAt'>;
type SortDir = 'asc' | 'desc';

/** Compute next available User ID (U0001, U0002, …) from existing rows */
function getNextUserId(rows: UserRow[]): string {
	const prefix = 'U';
	let max = 0;
	for (const r of rows) {
		const id = r.employeeId || '';
		if (id.startsWith(prefix)) {
			const n = parseInt(id.slice(prefix.length), 10);
			if (!isNaN(n) && n > max) max = n;
		}
	}
	return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

export default function ManageUsersPage() {
	const [rows, setRows] = useState<UserRow[]>([]);
	const [labs, setLabs] = useState<LabRow[]>([]);
	const [loading, setLoading] = useState(false);

	// Form state
	const [editingId, setEditingId] = useState<string | null>(null);
	const [name, setName] = useState('');
	const [dob, setDob] = useState<string>('');
	const [address, setAddress] = useState('');
	const [phone, setPhone] = useState('');
	const [role, setRole] = useState<'USER' | 'ADMIN' | 'SUPER_ADMIN' | ''>('');
	const [email, setEmail] = useState('');
	const [labCode, setLabCode] = useState<string>(''); // << use labCode

	// Messages
	const [formErr, setFormErr] = useState<string | null>(null);
	const [formOk, setFormOk] = useState<string | null>(null);
	const [listErr, setListErr] = useState<string | null>(null);

	// Sorting + search
	const [sortKey, setSortKey] = useState<SortKey>('createdAt');
	const [sortDir, setSortDir] = useState<SortDir>('desc');
	const [q, setQ] = useState('');

	// Selection
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const anySelected = selected.size > 0;

	// Password modal (on create)
	const [pwdModalOpen, setPwdModalOpen] = useState(false);
	const [pwdMask, setPwdMask] = useState(true);
	const [pwdCopied, setPwdCopied] = useState(false);
	const [modalPassword, setModalPassword] = useState<string>('');
	const [modalUserId, setModalUserId] = useState<string>('');
	const [modalUserName, setModalUserName] = useState<string>('');

	async function load() {
		setLoading(true);
		setListErr(null);
		setSelected(new Set());
		try {
			const [resUsers, resLabs] = await Promise.all([
				fetch('/api/users', { cache: 'no-store' }),
				fetch('/api/labs?select=codeAndName', { cache: 'no-store' }), // assume your /api/labs supports this
			]);
			const dataUsers = await resUsers.json().catch(() => []);
			const dataLabs = await resLabs.json().catch(() => []);

			if (!resUsers.ok) {
				setListErr((dataUsers && dataUsers.error) || `Load failed: ${resUsers.status}`);
				setRows([]);
			} else {
				// map backend userId -> UI employeeId
				const normalized = (Array.isArray(dataUsers) ? dataUsers : []).map((u: any) => ({
					...u,
					employeeId: u.userId,
				}));
				setRows(normalized);
			}

			// expect labs [{ labCode, name }]
			setLabs(resLabs.ok && Array.isArray(dataLabs) ? dataLabs : []);
		} catch (e: any) {
			setListErr(e?.message || 'Network error');
			setRows([]); setLabs([]);
		} finally { setLoading(false); }
	}
	useEffect(() => { load(); }, []);

	function resetForm() {
		setEditingId(null);
		setName(''); setDob(''); setAddress(''); setPhone('');
		setRole(''); setEmail(''); setLabCode('');
		setFormErr(null); setFormOk(null);
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setFormErr(null); setFormOk(null);

		const normalizedPhone = (phone || '').replace(/\D+/g, '');
		if (!labCode) { setFormErr('Please select Lab.'); return; }
		if (!name.trim() || !normalizedPhone || !role) { setFormErr('Please fill Name, Mobile and Role.'); return; }
		if (normalizedPhone.length < 10 || normalizedPhone.length > 15) { setFormErr('Please enter a valid Mobile number (10–15 digits).'); return; }
		const allowed = new Set(['USER', 'ADMIN', 'SUPER_ADMIN']);
		if (!allowed.has(role)) { setFormErr('Role must be one of: User, Admin, Super Admin.'); return; }

		const payload: any = {
			name: name.trim(),
			phone: normalizedPhone,
			role,
			dob: dob ? new Date(dob).toISOString() : null,
			address: address.trim() || null,
			email: email.trim() || null,
			labCode, // << send labCode, not labId
		};

		try {
			const res = await fetch(editingId ? `/api/users/${editingId}` : '/api/users', {
				method: editingId ? 'PUT' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) { setFormErr(data?.error || 'Save failed'); return; }

			if (!editingId) {
				if (data?.defaultPassword) {
					setModalPassword(data.defaultPassword);
					setModalUserId(data.userId || '');   // from API
					setModalUserName(data.name || '');
					setPwdMask(true); setPwdCopied(false); setPwdModalOpen(true);
				}
				setFormOk('Created!');
			} else setFormOk('Updated!');

			await load();
			if (!editingId) resetForm();
		} catch (err: any) {
			setFormErr(err?.message || 'Network error');
		}
	}

	function startEdit(u: UserRow) {
		setEditingId(u.id);
		setName(u.name || '');
		setDob(u.dob ? u.dob.slice(0, 10) : '');
		setAddress(u.address || '');
		setPhone(u.phone || '');
		setRole(((u.role || '') as any) || '');
		setEmail('');
		setLabCode(u.lab?.labCode || ''); // << use labCode
		setFormErr(null); setFormOk(null);
	}

	type SortKey = keyof Pick<UserRow, 'employeeId' | 'name' | 'phone' | 'role' | 'createdAt'>;
	function sortBy(key: SortKey) { if (key === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDir('asc'); } }

	const filtered = useMemo(() => {
		const term = q.trim().toLowerCase();
		const base = term
			? rows.filter((r) =>
				[r.employeeId, r.name, r.phone, r.role, r.address, r.lab?.labCode]
					.filter(Boolean).some(v => String(v).toLowerCase().includes(term))
			)
			: rows;

		const sorted = [...base].sort((a, b) => {
			const va = (a[sortKey] ?? '') as any; const vb = (b[sortKey] ?? '') as any;
			if (va === vb) return 0;
			return (sortDir === 'asc') ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
		});
		return sorted;
	}, [rows, q, sortKey, sortDir]);

	function toggleOne(id: string, checked: boolean) {
		setSelected(prev => { const next = new Set(prev); if (checked) next.add(id); else next.delete(id); return next; });
	}
	function selectAllVisible(checked: boolean) { if (!checked) return setSelected(new Set()); setSelected(new Set(filtered.map(r => r.id))); }

	async function deleteSelected() {
		if (!anySelected) return;
		if (!confirm(`Delete ${selected.size} selected ${selected.size === 1 ? 'user' : 'users'}? This cannot be undone.`)) return;
		const ids = Array.from(selected);
		const results = await Promise.all(ids.map(async (id) => { try { const r = await fetch(`/api/users/${id}`, { method: 'DELETE' }); return r.ok; } catch { return false; } }));
		if (results.some(ok => !ok)) setListErr('Some items could not be deleted.');
		setSelected(new Set()); await load();
	}

	const Col = ({ k, label }: { k: SortKey; label: string }) => {
		const active = sortKey === k;
		return (
			<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700 cursor-pointer select-none" onClick={() => sortBy(k)}>
				<div className="inline-flex items-center gap-1">
					<span>{label}</span>
					{active ? (sortDir === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : null}
				</div>
			</th>
		);
	};

	// Preview next user ID (create mode only)
	const previewEmployeeId = useMemo(() => (
		editingId ? (rows.find(r => r.id === editingId)?.employeeId || '') : getNextUserId(rows)
	), [editingId, rows]);

	// Copy password helpers
	async function copyToClipboard(text: string) {
		try { await navigator.clipboard.writeText(text); setPwdCopied(true); setTimeout(() => setPwdCopied(false), 1500); } catch { }
	}

	return (
		<div className="space-y-4">
			{/* Title bar */}
			<div className="rounded-xl border bg-white px-5 py-4 shadow-sm flex items-center gap-3">
				<div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand-600">
					<UsersIcon className="h-5 w-5" />
				</div>
				<h1 className="text-2xl md:text-3xl font-bold tracking-tight">User Management</h1>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
				{/* Form */}
				<div className="lg:col-span-4 rounded-xl border bg-white p-4 shadow-sm">
					<div className="flex items-center justify-between mb-3">
						<h2 className="text-base font-semibold">{editingId ? 'Update User' : 'Add New User'}</h2>
						<button onClick={resetForm} className="text-sm text-gray-600 hover:underline">Clear</button>
					</div>

					{formErr && <div className="mb-3 text-sm text-red-600">{formErr}</div>}
					{formOk && <div className="mb-3 text-sm text-green-600">{formOk}</div>}

					<form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
						<div>
							<label className="block text-sm mb-1">User ID</label>
							<input className="w-full border rounded px-3 py-2 bg-gray-50" value={previewEmployeeId || ''} readOnly />
						</div>

						<div>
							<label className="block text-sm mb-1">Lab Code</label>
							<select className="w-full border rounded px-3 py-2" value={labCode} onChange={(e) => setLabCode(e.target.value)}>
								<option value="">Select Lab</option>
								{labs.map((lab) => (
									<option key={lab.labCode} value={lab.labCode}>{lab.name}</option>
								))}
							</select>
						</div>

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
							<label className="block text-sm mb-1">Role *</label>
							<select className="w-full border rounded px-3 py-2" value={role} onChange={(e) => setRole(e.target.value as any)}>
								<option value="">Select…</option>
								<option value="USER">User</option>
								<option value="ADMIN">Admin</option>
								<option value="SUPER_ADMIN">Super Admin</option>
							</select>
						</div>

						<div className="md:col-span-2">
							<label className="block text-sm mb-1">Email (optional)</label>
							<input type="email" className="w-full border rounded px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
						</div>

						<div className="md:col-span-2 flex gap-2 mt-1">
							<button className="rounded bg-brand text-white px-4 py-2">{editingId ? 'Update' : 'Create'}</button>
							<button type="button" className="rounded border px-4 py-2" onClick={resetForm}>Reset</button>
						</div>
					</form>
				</div>

				{/* Table */}
				<div className="lg:col-span-8 rounded-xl border bg-white p-4 shadow-sm">
					<div className="flex flex-wrap items-center gap-2 justify-between mb-3">
						<h2 className="text-base font-semibold">User Information</h2>
						<div className="flex items-center gap-2">
							{anySelected && (
								<button type="button" onClick={deleteSelected} className="inline-flex items-center justify-center rounded border p-2 text-red-600 hover:bg-red-50" title="Delete selected" aria-label="Delete selected">
									<Trash2 className="h-4 w-4" />
								</button>
							)}
							<div className="relative">
								<Search className="h-4 w-4 absolute left-2 top-2.5 text-gray-400" />
								<input placeholder="Search…" className="pl-8 pr-3 py-2 border rounded w-64" value={q} onChange={(e) => setQ(e.target.value)} />
							</div>
						</div>
					</div>

					<div className="overflow-x-auto overflow-y-auto max-h-[400px] rounded border">
						<table className="min-w-full border rounded">
							<thead className="bg-gray-50">
								<tr>
									<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">
										<input type="checkbox" aria-label="Select all visible" checked={filtered.length > 0 && filtered.every(r => selected.has(r.id))} onChange={(e) => selectAllVisible(e.target.checked)} />
									</th>
									<Col k="employeeId" label="User ID" />
									<Col k="name" label="Name" />
									<Col k="phone" label="Mobile" />
									<Col k="role" label="Role" />
									<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">Lab Code</th>
								</tr>
							</thead>
							<tbody>
								{loading ? (
									<tr><td colSpan={7} className="px-3 py-4 text-center text-sm text-gray-500">Loading…</td></tr>
								) : filtered.length === 0 ? (
									<tr><td colSpan={7} className="px-3 py-4 text-center text-sm text-gray-500">No users found</td></tr>
								) : (
									filtered.map((u) => {
										const isChecked = selected.has(u.id);
										return (
											<tr key={u.id} className="border-t hover:bg-gray-50">
												<td className="px-3 py-2 text-sm">
													<input type="checkbox" checked={isChecked} onChange={(e) => toggleOne(u.id, e.target.checked)} aria-label={`Select ${u.employeeId || u.name || u.id}`} />
												</td>
												<td className="px-3 py-2 text-sm">{u.employeeId}</td>
												<td className="px-3 py-2 text-sm">
													<button className="underline underline-offset-2" onClick={() => startEdit(u)} title="Edit this user">
														{u.name}
													</button>
												</td>
												<td className="px-3 py-2 text-sm">{u.phone}</td>
												<td className="px-3 py-2 text-sm">{u.role}</td>
												<td className="px-3 py-2 text-sm">{u.lab?.name || ''}</td>
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>

					{listErr && <div className="mt-3 text-sm text-red-600">{listErr}</div>}
				</div>
			</div>

			{/* Password Modal */}
			{pwdModalOpen && (
				<div className="fixed inset-0 z-50">
					<div className="absolute inset-0 bg-black/40" onClick={() => setPwdModalOpen(false)} />
					<div className="absolute inset-0 flex items-center justify-center p-4">
						<div className="w-full max-w-md rounded-2xl bg-white shadow-xl border">
							<div className="flex items-center justify-between px-4 py-3 border-b">
								<div className="font-semibold">Share Password</div>
								<button onClick={() => setPwdModalOpen(false)} className="p-1 rounded hover:bg-gray-100" aria-label="Close">
									<X className="h-5 w-5" />
								</button>
							</div>

							<div className="px-4 py-4 space-y-3">
								{(modalUserId || modalUserName) && (
									<div className="text-sm text-gray-600">
										<span className="font-medium">User:</span> {modalUserName || '—'} {modalUserId ? `(${modalUserId})` : ''}
									</div>
								)}

								<label className="block text-sm text-gray-700">Temporary Password</label>
								<div className="flex items-center gap-2">
									<input className="flex-1 border rounded px-3 py-2 bg-gray-50" type={pwdMask ? 'password' : 'text'} value={modalPassword} readOnly />
									<button className="p-2 rounded border hover:bg-gray-50" onClick={() => setPwdMask(!pwdMask)} title={pwdMask ? 'Show' : 'Hide'}>
										{pwdMask ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
									</button>
									<button className="p-2 rounded border hover:bg-gray-50" onClick={() => copyToClipboard(modalPassword)} title="Copy">
										{pwdCopied ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
									</button>
								</div>

								<p className="text-xs text-gray-500">Copy and share this password via WhatsApp/SMS. They can change it after logging in.</p>
							</div>

							<div className="px-4 py-3 border-t flex justify-end">
								<button className="rounded bg-brand text-white px-4 py-2" onClick={() => setPwdModalOpen(false)}>Close</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
