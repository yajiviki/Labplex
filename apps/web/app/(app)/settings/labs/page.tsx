'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, ChevronDown, ChevronUp, Search, Trash2 } from 'lucide-react';

type LabRow = {
	id: string;
	labCode: string;
	name: string;
	address: string | null;
	phone: string;
	email: string | null;
	createdAt: string;
};

type SortKey = keyof Pick<LabRow, 'labCode' | 'name' | 'phone' | 'createdAt'>;
type SortDir = 'asc' | 'desc';

export default function ManageLabsPage() {
	const [rows, setRows] = useState<LabRow[]>([]);
	const [loading, setLoading] = useState(false);

	// form
	const [editingId, setEditingId] = useState<string | null>(null);
	const [name, setName] = useState('');
	const [address, setAddress] = useState('');
	const [phone, setPhone] = useState('');
	const [email, setEmail] = useState('');

	// messages
	const [formErr, setFormErr] = useState<string | null>(null);
	const [formOk, setFormOk] = useState<string | null>(null);
	const [listErr, setListErr] = useState<string | null>(null);

	// table controls
	const [sortKey, setSortKey] = useState<SortKey>('createdAt');
	const [sortDir, setSortDir] = useState<SortDir>('desc');
	const [q, setQ] = useState('');

	// selection
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const anySelected = selected.size > 0;

	async function load() {
		setLoading(true);
		setListErr(null);
		setSelected(new Set());
		try {
			const res = await fetch('/api/labs', { cache: 'no-store' });
			const data = await res.json().catch(() => []);
			if (!res.ok) {
				setListErr((data && data.error) || `Load failed: ${res.status}`);
				setRows([]);
			} else {
				setRows(Array.isArray(data) ? data : []);
			}
		} catch (e: any) {
			setListErr(e?.message || 'Network error');
			setRows([]);
		} finally {
			setLoading(false);
		}
	}
	useEffect(() => { load(); }, []);

	function resetForm() {
		setEditingId(null);
		setName(''); setAddress(''); setPhone(''); setEmail('');
		setFormErr(null); setFormOk(null);
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setFormErr(null); setFormOk(null);

		const normalizedPhone = (phone || '').replace(/\D+/g, '');
		if (!name.trim() || !normalizedPhone) {
			setFormErr('Please fill Name and Mobile.');
			return;
		}
		if (normalizedPhone.length < 10 || normalizedPhone.length > 15) {
			setFormErr('Please enter a valid Mobile number (10–15 digits).');
			return;
		}

		const payload = {
			name: name.trim(),
			address: address.trim() || null,
			phone: normalizedPhone,
			email: email.trim() || null,
		};

		try {
			const res = await fetch(editingId ? `/api/labs/${editingId}` : '/api/labs', {
				method: editingId ? 'PUT' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				setFormErr((data && data.error) || 'Save failed');
				return;
			}
			setFormOk(editingId ? 'Updated!' : 'Created!');
			await load();
			if (!editingId) resetForm();
		} catch (e: any) {
			setFormErr(e?.message || 'Network error');
		}
	}

	function startEdit(l: LabRow) {
		setEditingId(l.id);
		setName(l.name);
		setAddress(l.address || '');
		setPhone(l.phone);
		setEmail(l.email || '');
		setFormErr(null); setFormOk(null);
	}

	function sortBy(key: SortKey) {
		if (key === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
		else { setSortKey(key); setSortDir('asc'); }
	}

	const filtered = useMemo(() => {
		const term = q.trim().toLowerCase();
		const base = term
			? rows.filter((r) =>
				[r.labCode, r.name, r.phone, r.address, r.email]
					.filter(Boolean).some(v => String(v).toLowerCase().includes(term))
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

	function toggleOne(id: string, checked: boolean) {
		setSelected(prev => {
			const next = new Set(prev);
			if (checked) next.add(id); else next.delete(id);
			return next;
		});
	}
	function selectAllVisible(checked: boolean) {
		if (!checked) return setSelected(new Set());
		setSelected(new Set(filtered.map(r => r.id)));
	}

	async function deleteSelected() {
		if (!anySelected) return;
		if (!confirm(`Delete ${selected.size} lab(s)? This cannot be undone.`)) return;

		const ids = Array.from(selected);
		const results = await Promise.all(ids.map(async (id) => {
			try {
				const r = await fetch(`/api/labs/${id}`, { method: 'DELETE' });
				return r.ok;
			} catch { return false; }
		}));
		if (results.some(ok => !ok)) setListErr('Some items could not be deleted.');
		setSelected(new Set());
		await load();
	}

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
		<div className="space-y-4">
			<div className="rounded-xl border bg-white px-5 py-4 shadow-sm flex items-center gap-3">
				<div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand-600">
					<Building2 className="h-5 w-5" />
				</div>
				<h1 className="text-2xl md:text-3xl font-bold tracking-tight">Manage Labs</h1>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
				{/* Form */}
				<div className="lg:col-span-4 rounded-xl border bg-white p-4 shadow-sm">
					<div className="flex items-center justify-between mb-3">
						<h2 className="text-base font-semibold">{editingId ? 'Update Lab' : 'Add New Lab'}</h2>
						<button onClick={resetForm} className="text-sm text-gray-600 hover:underline">Clear</button>
					</div>

					{formErr && <div className="mb-3 text-sm text-red-600">{formErr}</div>}
					{formOk && <div className="mb-3 text-sm text-green-600">{formOk}</div>}

					<form onSubmit={onSubmit} className="grid grid-cols-1 gap-3">
						<div>
							<label className="block text-sm mb-1">Lab Code</label>
							<input className="w-full border rounded px-3 py-2 bg-gray-50" value={editingId ? (rows.find(r => r.id === editingId)?.labCode || '') : 'Auto-generated (LB##)'} readOnly />
						</div>
						<div>
							<label className="block text-sm mb-1">Name *</label>
							<input className="w-full border rounded px-3 py-2" value={name} onChange={(e) => setName(e.target.value)} />
						</div>
						<div>
							<label className="block text-sm mb-1">Address</label>
							<input className="w-full border rounded px-3 py-2" value={address} onChange={(e) => setAddress(e.target.value)} />
						</div>
						<div>
							<label className="block text-sm mb-1">Mobile *</label>
							<input className="w-full border rounded px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
						</div>
						<div>
							<label className="block text-sm mb-1">Email (optional)</label>
							<input type="email" className="w-full border rounded px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
						</div>
						<div className="flex gap-2 mt-1">
							<button className="rounded bg-brand text-white px-4 py-2">{editingId ? 'Update' : 'Create'}</button>
							<button type="button" className="rounded border px-4 py-2" onClick={resetForm}>Reset</button>
						</div>
					</form>
				</div>

				{/* Table */}
				<div className="lg:col-span-8 rounded-xl border bg-white p-4 shadow-sm">
					<div className="flex flex-wrap items-center gap-2 justify-between mb-3">
						<h2 className="text-base font-semibold">Lab Information</h2>

						<div className="flex items-center gap-2">
							{anySelected && (
								<button
									type="button"
									onClick={deleteSelected}
									className="inline-flex items-center justify-center rounded border p-2 text-red-600 hover:bg-red-50"
									title="Delete selected"
									aria-label="Delete selected"
								>
									<Trash2 className="h-4 w-4" />
								</button>
							)}
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
					</div>

					<div className="overflow-x-auto">
						<table className="min-w-full border rounded">
							<thead className="bg-gray-50">
								<tr>
									<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">
										<input
											type="checkbox"
											aria-label="Select all visible"
											checked={filtered.length > 0 && filtered.every(r => selected.has(r.id))}
											onChange={(e) => selectAllVisible(e.target.checked)}
										/>
									</th>
									<Col k="labCode" label="Lab Code" />
									<Col k="name" label="Name" />
									<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">Address</th>
									<Col k="phone" label="Mobile" />
									<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">Email</th>
									<Col k="createdAt" label="Created" />
								</tr>
							</thead>
							<tbody>
								{loading ? (
									<tr><td colSpan={7} className="px-3 py-4 text-center text-sm text-gray-500">Loading…</td></tr>
								) : filtered.length === 0 ? (
									<tr><td colSpan={7} className="px-3 py-4 text-center text-sm text-gray-500">No labs found</td></tr>
								) : (
									filtered.map((l) => {
										const isChecked = selected.has(l.id);
										return (
											<tr key={l.id} className="border-t hover:bg-gray-50">
												<td className="px-3 py-2 text-sm">
													<input type="checkbox" checked={isChecked} onChange={(e) => toggleOne(l.id, e.target.checked)} />
												</td>
												<td className="px-3 py-2 text-sm">{l.labCode}</td>
												<td className="px-3 py-2 text-sm">
													<button className="underline underline-offset-2" onClick={() => startEdit(l)}>{l.name}</button>
												</td>
												<td className="px-3 py-2 text-sm">{l.address}</td>
												<td className="px-3 py-2 text-sm">{l.phone}</td>
												<td className="px-3 py-2 text-sm">{l.email}</td>
												<td className="px-3 py-2 text-sm">{new Date(l.createdAt).toLocaleDateString()}</td>
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
		</div>
	);
}
