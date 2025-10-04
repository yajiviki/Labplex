'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
	Building2, ChevronDown, ChevronUp, Search, Trash2, Upload
} from 'lucide-react';

type VendorRow = {
	id: string;
	vendorId: string;        // TPA01…
	tpaName: string;
	nickName: string | null; // ← added
	address: string | null;
	phone: string | null;
	email: string | null;
	isActive?: number;
	createdAt: string;
};

type SortKey = keyof Pick<VendorRow, 'vendorId' | 'tpaName' | 'nickName' | 'phone' | 'email' | 'createdAt'>;
type SortDir = 'asc' | 'desc';

function nextVendorId(rows: { vendorId?: string }[]) {
	const prefix = 'TPA';
	let max = 0;
	for (const r of rows) {
		const v = r.vendorId || '';
		if (v.startsWith(prefix)) {
			const n = parseInt(v.slice(prefix.length), 10);
			if (!Number.isNaN(n) && n > max) max = n;
		}
	}
	return `${prefix}${String(max + 1).padStart(2, '0')}`;
}

// CSV parser with quote support
function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let cur = '', inQuotes = false;
	let row: string[] = [];
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		if (ch === '"') {
			if (inQuotes && text[i + 1] === '"') { cur += '"'; i++; }
			else { inQuotes = !inQuotes; }
		} else if (ch === ',' && !inQuotes) {
			row.push(cur.trim()); cur = '';
		} else if ((ch === '\n' || ch === '\r') && !inQuotes) {
			if (cur.length || row.length) { row.push(cur.trim()); rows.push(row); row = []; cur = ''; }
		} else cur += ch;
	}
	if (cur.length || row.length) { row.push(cur.trim()); rows.push(row); }
	return rows.filter(r => r.some(c => c.length));
}

function Dialog({ open, title, message, onClose }: {
	open: boolean; title: string; message: string; onClose: () => void
}) {
	if (!open) return null;
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<div className="absolute inset-0 bg-black/30" onClick={onClose} />
			<div className="relative z-10 w-full max-w-md rounded-xl border bg-white p-4 shadow-lg">
				<div className="text-base font-semibold mb-2">{title}</div>
				<div className="text-sm text-gray-700 whitespace-pre-wrap">{message}</div>
				<div className="mt-3 flex justify-end">
					<button onClick={onClose} className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50">
						Close
					</button>
				</div>
			</div>
		</div>
	);
}

export default function VendorsPage() {
	const [rows, setRows] = useState<VendorRow[]>([]);
	const [loading, setLoading] = useState(false);

	// form (left)
	const [editingId, setEditingId] = useState<string | null>(null);
	const [tpaName, setTpaName] = useState('');
	const [nickName, setNickName] = useState(''); // ← added
	const [address, setAddress] = useState('');
	const [phone, setPhone] = useState('');
	const [email, setEmail] = useState('');

	// messages
	const [formErr, setFormErr] = useState<string | null>(null);
	const [formOk, setFormOk] = useState<string | null>(null);
	const [listErr, setListErr] = useState<string | null>(null);

	// table (right)
	const [sortKey, setSortKey] = useState<SortKey>('createdAt');
	const [sortDir, setSortDir] = useState<SortDir>('desc');
	const [q, setQ] = useState('');
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const anySelected = selected.size > 0;

	// dialog
	const [dlgOpen, setDlgOpen] = useState(false);
	const [dlgTitle, setDlgTitle] = useState('');
	const [dlgMsg, setDlgMsg] = useState('');

	const fileInputRef = useRef<HTMLInputElement | null>(null);

	function showDialog(title: string, msg: string) {
		setDlgTitle(title);
		setDlgMsg(msg);
		setDlgOpen(true);
	}

	async function load() {
		setLoading(true);
		setListErr(null);
		setSelected(new Set());
		try {
			const res = await fetch('/api/vendors', { cache: 'no-store' });
			const data = await res.json().catch(() => []);
			if (!res.ok) {
				setListErr(data?.error || `Load failed: ${res.status}`);
				setRows([]);
			} else {
				setRows((Array.isArray(data) ? data : []).map((v: any) => ({
					id: v.id,
					vendorId: v.vendorId,
					tpaName: v.tpaName,
					nickName: v.nickName ?? null, // ← added
					address: v.address ?? null,
					phone: v.phone ?? null,
					email: v.email ?? null,
					isActive: v.isActive ?? 1,
					createdAt: v.createdAt,
				})));
			}
		} catch (e: any) {
			setListErr(e?.message || 'Network error');
			setRows([]);
		} finally { setLoading(false); }
	}
	useEffect(() => { load(); }, []);

	const nextId = useMemo(() => nextVendorId(rows), [rows]);

	function resetForm() {
		setEditingId(null);
		setTpaName(''); setNickName(''); setAddress(''); setPhone(''); setEmail('');
		setFormErr(null); setFormOk(null);
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setFormErr(null); setFormOk(null);

		if (!tpaName.trim()) { setFormErr('TPA Name is required.'); return; }
		const normalizedPhone = (phone || '').replace(/\D+/g, '') || null;

		const payload = {
			vendorId: editingId ? undefined : nextId, // assign only when creating
			tpaName: tpaName.trim(),
			nickName: nickName.trim() || null,       // ← added
			address: address.trim() || null,
			phone: normalizedPhone,
			email: (email || '').trim() || null,
		};

		try {
			const res = await fetch(editingId ? `/api/vendors/${editingId}` : '/api/vendors', {
				method: editingId ? 'PUT' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				setFormErr(data?.error || 'Save failed');
				showDialog('Save failed', data?.error || 'Unable to save vendor');
				return;
			}
			setFormOk(editingId ? 'Updated!' : 'Created!');
			showDialog('Success', editingId ? 'Vendor updated.' : 'Vendor created.');
			await load();
			if (!editingId) resetForm();
		} catch (e: any) {
			setFormErr(e?.message || 'Network error');
			showDialog('Network error', e?.message || 'Please try again.');
		}
	}

	function startEdit(v: VendorRow) {
		setEditingId(v.id);
		setTpaName(v.tpaName || '');
		setNickName(v.nickName || ''); // ← added
		setAddress(v.address || '');
		setPhone(v.phone || '');
		setEmail(v.email || '');
		setFormErr(null); setFormOk(null);
	}

	function sortBy(key: SortKey) {
		if (key === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
		else { setSortKey(key); setSortDir('asc'); }
	}

	const filtered = useMemo(() => {
		const term = q.trim().toLowerCase();
		const base = term
			? rows.filter(r =>
				[r.vendorId, r.tpaName, r.nickName, r.phone, r.email, r.address]
					.filter(Boolean).some(v => String(v).toLowerCase().includes(term)))
			: rows;

		const sorted = [...base].sort((a, b) => {
			const va = (a[sortKey] ?? '') as any;
			const vb = (b[sortKey] ?? '') as any;
			if (va === vb) return 0;
			return (sortDir === 'asc') ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
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
		if (!confirm(`Delete ${selected.size} TPA(s)? This cannot be undone.`)) return;
		const ids = Array.from(selected);
		const results = await Promise.all(ids.map(async (id) => {
			try { const r = await fetch(`/api/vendors/${id}`, { method: 'DELETE' }); return r.ok; }
			catch { return false; }
		}));
		if (results.some(ok => !ok)) {
			setListErr('Some items could not be deleted.');
			showDialog('Delete', 'Some items could not be deleted.');
		} else {
			showDialog('Delete', 'Selected TPAs deleted.');
		}
		setSelected(new Set());
		await load();
	}

	const Col = ({ k, label }: { k: SortKey; label: string }) => {
		const active = sortKey === k;
		return (
			<th
				className="px-3 py-2 text-left text-sm font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap"
				onClick={() => sortBy(k)}
			>
				<div className="inline-flex items-center gap-1">
					<span>{label}</span>
					{active ? (sortDir === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : null}
				</div>
			</th>
		);
	};

	// Import (CSV/JSON)
	async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = '';
		if (!file) return;

		try {
			const text = await file.text();
			const rowsForServer: Array<Record<string, any>> = [];
			const isCSV = file.name.toLowerCase().endsWith('.csv');

			if (isCSV) {
				const rowsCsv = parseCsv(text);
				if (!rowsCsv.length) throw new Error('Empty CSV');
				const headers = rowsCsv[0].map(s => s.toLowerCase());
				const dataRows = rowsCsv.slice(1);
				const idx = (name: string) => headers.findIndex(h => h === name.toLowerCase());
				const iVendorId = idx('vendorid'); // optional
				const iTpaName = idx('tpaname');  // required
				const iNickName = idx('nickname'); // optional  ← NEW
				const iAddress = idx('address');
				const iPhone = idx('phone');
				const iEmail = idx('email');

				for (const r of dataRows) {
					const tpaName = (iTpaName >= 0 ? r[iTpaName] : '').trim();
					if (!tpaName) continue;
					rowsForServer.push({
						vendorId: iVendorId >= 0 ? (r[iVendorId] || '').trim() : null,
						tpaName,
						nickName: iNickName >= 0 ? (r[iNickName] || '').trim() : null, // ← NEW
						address: iAddress >= 0 ? (r[iAddress] || '').trim() : null,
						phone: iPhone >= 0 ? (r[iPhone] || '').trim() : null,
						email: iEmail >= 0 ? (r[iEmail] || '').trim() : null,
					});
				}
			} else {
				const json = JSON.parse(text);
				if (!Array.isArray(json)) throw new Error('File JSON must be an array');
				for (const r of json) {
					if (!r?.tpaName) continue;
					rowsForServer.push({
						vendorId: r.vendorId ?? null,
						tpaName: String(r.tpaName),
						nickName: r.nickName ?? null, // ← NEW
						address: r.address ?? null,
						phone: r.phone ?? null,
						email: r.email ?? null,
					});
				}
			}

			if (!rowsForServer.length) { showDialog('Import', 'No valid rows found.'); return; }

			const res = await fetch('/api/vendors/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ rows: rowsForServer }),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				showDialog('Import failed', data?.error || 'Please check file format.');
				return;
			}
			showDialog('Import completed', `Inserted: ${data?.inserted || 0}\nUpdated: ${data?.upserted || 0}\nSkipped: ${data?.skipped || 0}`);
			await load();
		} catch (e: any) {
			showDialog('Import error', e?.message || 'Failed to import file.');
		}
	}

	return (
		<div className="space-y-4">
			<Dialog open={dlgOpen} title={dlgTitle} message={dlgMsg} onClose={() => setDlgOpen(false)} />

			<div className="rounded-xl border bg-white px-5 py-4 shadow-sm flex items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand-600">
						<Building2 className="h-5 w-5" />
					</div>
					<h1 className="text-2xl md:text-3xl font-bold tracking-tight">Manage TPA (Vendors)</h1>
				</div>

				<div className="flex items-center gap-2">
					<input
						ref={fileInputRef}
						type="file"
						accept=".csv,application/json"
						className="hidden"
						onChange={onImportFile}
					/>
					<button
						type="button"
						className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-gray-50"
						onClick={() => fileInputRef.current?.click()}
						title="Import CSV / JSON"
					>
						<Upload className="h-4 w-4" />
						Import
					</button>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
				{/* LEFT: Form */}
				<div className="lg:col-span-4 rounded-xl border bg-white p-4 shadow-sm">
					<div className="flex items-center justify-between mb-3">
						<h2 className="text-base font-semibold">{editingId ? 'Update TPA' : 'Add New TPA'}</h2>
						<button onClick={resetForm} className="text-sm text-gray-600 hover:underline">Clear</button>
					</div>

					{formErr && <div className="mb-3 text-sm text-red-600">{formErr}</div>}
					{formOk && <div className="mb-3 text-sm text-green-600">{formOk}</div>}

					<form onSubmit={onSubmit} className="grid grid-cols-1 gap-3">
						<div>
							<label className="block text-sm mb-1">TPA Code</label>
							<input
								className="w-full border rounded px-3 py-2 bg-gray-50"
								value={editingId ? (rows.find(r => r.id === editingId)?.vendorId || '') : nextId}
								readOnly
							/>
						</div>
						<div>
							<label className="block text-sm mb-1">TPA Name *</label>
							<input className="w-full border rounded px-3 py-2" value={tpaName} onChange={(e) => setTpaName(e.target.value)} />
						</div>
						<div>
							<label className="block text-sm mb-1">Nick Name</label>
							<input className="w-full border rounded px-3 py-2" value={nickName} onChange={(e) => setNickName(e.target.value)} />
						</div>
						<div>
							<label className="block text-sm mb-1">Email</label>
							<input type="email" className="w-full border rounded px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
						</div>
						<div>
							<label className="block text-sm mb-1">Mobile</label>
							<input className="w-full border rounded px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
						</div>
						<div>
							<label className="block text-sm mb-1">Address</label>
							<input className="w-full border rounded px-3 py-2" value={address} onChange={(e) => setAddress(e.target.value)} />
						</div>
						<div className="flex gap-2 mt-1">
							<button className="rounded bg-brand text-white px-4 py-2">{editingId ? 'Update' : 'Create'}</button>
							<button type="button" className="rounded border px-4 py-2" onClick={resetForm}>Reset</button>
						</div>
					</form>
				</div>

				{/* RIGHT: Table */}
				<div className="lg:col-span-8 rounded-xl border bg-white p-4 shadow-sm">
					<div className="flex flex-wrap items-center gap-2 justify-between mb-3 ">
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

					<div className="overflow-x-auto overflow-y-auto max-h-[400px] rounded border">
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
									<Col k="vendorId" label="TPA Code" />
									<Col k="tpaName" label="TPA Name" />
									<Col k="nickName" label="Nick Name" />
									<Col k="phone" label="Mobile" />
									<Col k="email" label="Email" />
								</tr>
							</thead>
							<tbody>
								{loading ? (
									<tr><td colSpan={8} className="px-3 py-4 text-center text-sm text-gray-500">Loading…</td></tr>
								) : filtered.length === 0 ? (
									<tr><td colSpan={8} className="px-3 py-4 text-center text-sm text-gray-500">No TPAs found</td></tr>
								) : (
									filtered.map((v) => {
										const isChecked = selected.has(v.id);
										return (
											<tr key={v.id} className="border-t hover:bg-gray-50">
												<td className="px-3 py-2 text-sm">
													<input type="checkbox" checked={isChecked} onChange={(e) => toggleOne(v.id, e.target.checked)} />
												</td>
												<td className="px-3 py-2 text-sm whitespace-nowrap">{v.vendorId}</td>
												<td className="px-3 py-2 text-sm whitespace-nowrap">
													<button className="underline underline-offset-2" onClick={() => startEdit(v)}>{v.tpaName}</button>
												</td>
												<td className="px-3 py-2 text-sm whitespace-nowrap">{v.nickName || ''}</td>
												<td className="px-3 py-2 text-sm whitespace-nowrap">{v.phone || ''}</td>
												<td className="px-3 py-2 text-sm">{v.email || ''}</td>
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
