'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, ChevronDown, ChevronUp, Search, Trash2 } from 'lucide-react';

type VendorRow = {
	id: string;
	vendorId: string;          // TPA01, TPA02, ...
	tpaName: string;
	insuranceName: string | null;
	address: string | null;
	phone: string;
	createdAt: string;
};

type SortKey = keyof Pick<VendorRow, 'vendorId' | 'tpaName' | 'phone' | 'createdAt'>;
type SortDir = 'asc' | 'desc';

/** Next vendor id: TPA01, TPA02, ... (2+ digits, grows as needed) */
function nextVendorId(rows: VendorRow[]): string {
	const prefix = 'TPA';
	let max = 0;
	for (const r of rows) {
		const id = r.vendorId || '';
		if (id.startsWith(prefix)) {
			const tail = id.slice(prefix.length); // "01"
			const n = parseInt(tail, 10);
			if (!isNaN(n) && n > max) max = n;
		}
	}
	const n = max + 1;
	// 2-digit padding up to 99; grows beyond that
	const tail = n < 10 ? `0${n}` : `${n}`;
	return `${prefix}${tail}`;
}

export default function VendorsPage() {
	const [rows, setRows] = useState<VendorRow[]>([]);
	const [loading, setLoading] = useState(false);

	// form
	const [editingId, setEditingId] = useState<string | null>(null);
	const [tpaName, setTpaName] = useState('');
	const [insuranceName, setInsuranceName] = useState('');
	const [address, setAddress] = useState('');
	const [phone, setPhone] = useState('');

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
		setLoading(true); setListErr(null); setSelected(new Set());
		try {
			const res = await fetch('/api/vendors', { cache: 'no-store' });
			const data = await res.json().catch(() => []);
			if (!res.ok) { setListErr(data?.error || `Load failed: ${res.status}`); setRows([]); }
			else setRows(Array.isArray(data) ? data : []);
		} catch (e: any) {
			setListErr(e?.message || 'Network error'); setRows([]);
		} finally { setLoading(false); }
	}
	useEffect(() => { load(); }, []);

	function resetForm() {
		setEditingId(null);
		setTpaName(''); setInsuranceName(''); setAddress(''); setPhone('');
		setFormErr(null); setFormOk(null);
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setFormErr(null); setFormOk(null);

		const normalizedPhone = (phone || '').replace(/\D+/g, '');
		if (!tpaName.trim() || !normalizedPhone) { setFormErr('Please fill TPA Name and Mobile.'); return; }
		if (normalizedPhone.length < 10 || normalizedPhone.length > 15) { setFormErr('Please enter a valid Mobile number (10–15 digits).'); return; }

		const payload = {
			tpaName: tpaName.trim(),
			insuranceName: insuranceName.trim() || null,
			address: address.trim() || null,
			phone: normalizedPhone,
		};

		try {
			const res = await fetch(editingId ? `/api/vendors/${editingId}` : '/api/vendors', {
				method: editingId ? 'PUT' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) { setFormErr(data?.error || 'Save failed'); return; }
			setFormOk(editingId ? 'Updated!' : 'Created!');
			await load();
			if (!editingId) resetForm();
		} catch (e: any) {
			setFormErr(e?.message || 'Network error');
		}
	}

	function startEdit(v: VendorRow) {
		setEditingId(v.id);
		setTpaName(v.tpaName || '');
		setInsuranceName(v.insuranceName || '');
		setAddress(v.address || '');
		setPhone(v.phone || '');
		setFormErr(null); setFormOk(null);
	}

	function sortBy(key: SortKey) { if (key === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); else { setSortKey(key); setSortDir('asc'); } }

	const filtered = useMemo(() => {
		const term = q.trim().toLowerCase();
		const base = term
			? rows.filter((r) =>
				[r.vendorId, r.tpaName, r.insuranceName, r.address, r.phone]
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
		if (!confirm(`Delete ${selected.size} selected ${selected.size === 1 ? 'vendor' : 'vendors'}? This cannot be undone.`)) return;
		const ids = Array.from(selected);
		const results = await Promise.all(ids.map(async (id) => {
			try { const r = await fetch(`/api/vendors/${id}`, { method: 'DELETE' }); return r.ok; }
			catch { return false; }
		}));
		if (results.some(ok => !ok)) setListErr('Some items could not be deleted.');
		setSelected(new Set()); await load();
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

	const previewVendorId = useMemo(() => (
		editingId ? (rows.find(r => r.id === editingId)?.vendorId || '') : nextVendorId(rows)
	), [editingId, rows]);

	return (
		<div className="space-y-4">
			{/* Title */}
			<div className="rounded-xl border bg-white px-5 py-4 shadow-sm flex items-center gap-3">
				<div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand-600">
					<Building2 className="h-5 w-5" />
				</div>
				<h1 className="text-2xl md:text-3xl font-bold tracking-tight">TPA Management</h1>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
				{/* Form */}
				<div className="lg:col-span-4 rounded-xl border bg-white p-4 shadow-sm">
					<div className="flex items-center justify-between mb-3">
						<h2 className="text-base font-semibold">{editingId ? 'Update Vendor' : 'Add New Vendor'}</h2>
						<button onClick={resetForm} className="text-sm text-gray-600 hover:underline">Clear</button>
					</div>

					{formErr && <div className="mb-3 text-sm text-red-600">{formErr}</div>}
					{formOk && <div className="mb-3 text-sm text-green-600">{formOk}</div>}

					<form onSubmit={onSubmit} className="grid grid-cols-1 gap-3">
						<div>
							<label className="block text-sm mb-1">TPA ID</label>
							<input className="w-full border rounded px-3 py-2 bg-gray-50" value={previewVendorId} readOnly />
						</div>
						<div>
							<label className="block text-sm mb-1">TPA Name *</label>
							<input className="w-full border rounded px-3 py-2" value={tpaName} onChange={(e) => setTpaName(e.target.value)} />
						</div>
						<div>
							<label className="block text-sm mb-1">Insurance Name</label>
							<input className="w-full border rounded px-3 py-2" value={insuranceName} onChange={(e) => setInsuranceName(e.target.value)} />
						</div>
						<div>
							<label className="block text-sm mb-1">Address</label>
							<input className="w-full border rounded px-3 py-2" value={address} onChange={(e) => setAddress(e.target.value)} />
						</div>
						<div>
							<label className="block text-sm mb-1">Mobile *</label>
							<input className="w-full border rounded px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
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
						<h2 className="text-base font-semibold">TPA Information</h2>
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
									<Col k="vendorId" label="TPA ID" />
									<Col k="tpaName" label="TPA Name" />
									<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">Insurance</th>
									<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">Address</th>
									<Col k="phone" label="Mobile" />
								</tr>
							</thead>
							<tbody>
								{loading ? (
									<tr><td colSpan={8} className="px-3 py-4 text-center text-sm text-gray-500">Loading…</td></tr>
								) : filtered.length === 0 ? (
									<tr><td colSpan={8} className="px-3 py-4 text-center text-sm text-gray-500">No vendors found</td></tr>
								) : (
									filtered.map((v) => {
										const isChecked = selected.has(v.id);
										return (
											<tr key={v.id} className="border-t hover:bg-gray-50">
												<td className="px-3 py-2 text-sm">
													<input
														type="checkbox"
														checked={isChecked}
														onChange={(e) => toggleOne(v.id, e.target.checked)}
														aria-label={`Select ${v.vendorId || v.tpaName || v.id}`}
													/>
												</td>
												<td className="px-3 py-2 text-sm">{v.vendorId}</td>
												<td className="px-3 py-2 text-sm">
													<button className="underline underline-offset-2" onClick={() => startEdit(v)} title="Edit this vendor">
														{v.tpaName}
													</button>
												</td>
												<td className="px-3 py-2 text-sm">{v.insuranceName}</td>
												<td className="px-3 py-2 text-sm">{v.address}</td>
												<td className="px-3 py-2 text-sm">{v.phone}</td>
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
