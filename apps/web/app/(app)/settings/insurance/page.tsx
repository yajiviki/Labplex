'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, ChevronDown, ChevronUp, Search, Trash2, Upload, X } from 'lucide-react';

/* ---------- Lightweight Dialogs ---------- */
function Dialog({ open, title, message, onClose }: {
	open: boolean; title: string; message: string; onClose: () => void
}) {
	if (!open) return null;
	return (
		<div className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center p-4">
			<div className="w-full max-w-md rounded-xl bg-white shadow-xl">
				<div className="flex items-center justify-between border-b px-4 py-3">
					<h3 className="text-base font-semibold">{title}</h3>
					<button className="p-1 rounded hover:bg-gray-100" onClick={onClose}><X className="h-4 w-4" /></button>
				</div>
				<div className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">{message}</div>
				<div className="flex justify-end gap-2 border-t px-4 py-3">
					<button onClick={onClose} className="rounded border px-4 py-1.5 hover:bg-gray-50">OK</button>
				</div>
			</div>
		</div>
	);
}
function ConfirmDialog({ open, title, message, onCancel, onConfirm }: {
	open: boolean; title: string; message: string; onCancel: () => void; onConfirm: () => void
}) {
	if (!open) return null;
	return (
		<div className="fixed inset-0 z-[100] bg-black/30 flex items-center justify-center p-4">
			<div className="w-full max-w-md rounded-xl bg-white shadow-xl">
				<div className="flex items-center justify-between border-b px-4 py-3">
					<h3 className="text-base font-semibold">{title}</h3>
					<button className="p-1 rounded hover:bg-gray-100" onClick={onCancel}><X className="h-4 w-4" /></button>
				</div>
				<div className="px-4 py-3 text-sm text-gray-700 whitespace-pre-wrap">{message}</div>
				<div className="flex justify-end gap-2 border-t px-4 py-3">
					<button onClick={onCancel} className="rounded border px-4 py-1.5 hover:bg-gray-50">Cancel</button>
					<button onClick={onConfirm} className="rounded bg-brand text-white px-4 py-1.5">Confirm</button>
				</div>
			</div>
		</div>
	);
}
/* ----------------------------------------- */

type InsRow = {
	id: string;
	code: string | null;
	name: string;
	address: string | null;
	phone: string | null;
	createdAt: string;
};

type SortKey = keyof Pick<InsRow, 'name' | 'code' | 'createdAt'>;
type SortDir = 'asc' | 'desc';

function getNextInsCode(rows: { code: string | null }[]): string {
	const prefix = 'INS';
	let max = 0;
	for (const r of rows) {
		const code = r.code || '';
		if (code.startsWith(prefix)) {
			const n = parseInt(code.slice(prefix.length), 10);
			if (!isNaN(n) && n > max) max = n;
		}
	}
	return `${prefix}${String(max + 1).padStart(2, '0')}`;
}

export default function InsurersPage() {
	const [rows, setRows] = useState<InsRow[]>([]);
	const [loading, setLoading] = useState(false);

	// form
	const [editingId, setEditingId] = useState<string | null>(null);
	const [code, setCode] = useState('');
	const [name, setName] = useState('');
	const [address, setAddress] = useState('');
	const [phone, setPhone] = useState('');

	// dialogs
	const [dialog, setDialog] = useState<{ open: boolean; title: string; message: string }>({ open: false, title: '', message: '' });
	const showDialog = (title: string, message: string) => setDialog({ open: true, title, message });
	const [confirmOpen, setConfirmOpen] = useState(false);

	// list controls
	const [listErr, setListErr] = useState<string | null>(null);
	const [sortKey, setSortKey] = useState<SortKey>('code'); // DEFAULT: sort by code
	const [sortDir, setSortDir] = useState<SortDir>('asc');  // ASC
	const [q, setQ] = useState('');
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const anySelected = selected.size > 0;

	// import
	const fileRef = useRef<HTMLInputElement | null>(null);

	async function load() {
		setLoading(true); setListErr(null); setSelected(new Set());
		try {
			const res = await fetch('/api/insurance', { cache: 'no-store' });
			const data = await res.json().catch(() => []);
			if (!res.ok) { setListErr(data?.error || `Load failed: ${res.status}`); setRows([]); }
			else setRows(Array.isArray(data) ? data : []);
		} catch (e: any) {
			setListErr(e?.message || 'Network error'); setRows([]);
		} finally { setLoading(false); }
	}
	useEffect(() => { load(); }, []);

	const nextCode = useMemo(() => getNextInsCode(rows), [rows]);

	function resetForm() {
		setEditingId(null);
		setCode(''); setName(''); setAddress(''); setPhone('');
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!name.trim()) { showDialog('Validation', 'Insurance name is required.'); return; }
		const normalizedPhone = (phone || '').replace(/\D+/g, '') || '';

		const effectiveCode = editingId ? (code?.trim() || null) : nextCode;

		const payload = {
			code: effectiveCode,
			name: name.trim(),
			address: address.trim() || null,
			phone: normalizedPhone || null,
		};

		try {
			const res = await fetch(editingId ? `/api/insurance/${editingId}` : '/api/insurance', {
				method: editingId ? 'PUT' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) { showDialog('Save failed', data?.error || 'Unable to save insurance.'); return; }
			showDialog('Success', editingId ? 'Insurance updated.' : 'Insurance created.');
			await load();
			if (!editingId) resetForm();
		} catch (e: any) {
			showDialog('Network error', e?.message || 'Please try again.');
		}
	}

	function startEdit(x: InsRow) {
		setEditingId(x.id);
		setCode(x.code || '');
		setName(x.name || '');
		setAddress(x.address || '');
		setPhone(x.phone || '');
	}

	function sortBy(key: SortKey) {
		if (key === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
		else { setSortKey(key); setSortDir('asc'); }
	}

	const filtered = useMemo(() => {
		const term = q.trim().toLowerCase();
		const base = term
			? rows.filter((r) =>
				[r.code, r.name, r.address, r.phone]
					.filter(Boolean).some(v => String(v).toLowerCase().includes(term))
			)
			: rows;

		const sorted = [...base].sort((a, b) => {
			// Null-safe compare (treat null/empty as '')
			const va = ((a[sortKey] ?? '') as any);
			const vb = ((b[sortKey] ?? '') as any);
			if (va === vb) return 0;
			if (sortDir === 'asc') return va > vb ? 1 : -1;
			return va < vb ? 1 : -1;
		});
		return sorted;
	}, [rows, q, sortKey, sortDir]);

	function toggleOne(id: string, checked: boolean) {
		setSelected(prev => { const next = new Set(prev); if (checked) next.add(id); else next.delete(id); return next; });
	}
	function selectAllVisible(checked: boolean) { if (!checked) return setSelected(new Set()); setSelected(new Set(filtered.map(r => r.id))); }

	async function handleDeleteConfirmed() {
		setConfirmOpen(false);
		const ids = Array.from(selected);
		const results = await Promise.all(ids.map(async (id) => {
			try { const r = await fetch(`/api/insurance/${id}`, { method: 'DELETE' }); return r.ok; }
			catch { return false; }
		}));
		if (results.some(ok => !ok)) showDialog('Partial failure', 'Some items could not be deleted.');
		else showDialog('Deleted', 'Selected company(ies) deleted.');
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

	// inside onImportFile (in page.tsx)
	function parseCsv(text: string): string[][] {
		const rows: string[][] = [];
		let cur = '';
		let row: string[] = [];
		let inQuotes = false;

		for (let i = 0; i < text.length; i++) {
			const ch = text[i];

			if (ch === '"') {
				if (inQuotes && text[i + 1] === '"') {
					// escaped quote
					cur += '"';
					i++;
				} else {
					inQuotes = !inQuotes;
				}
			} else if (ch === ',' && !inQuotes) {
				row.push(cur.trim());
				cur = '';
			} else if ((ch === '\n' || ch === '\r') && !inQuotes) {
				if (cur.length || row.length) {
					row.push(cur.trim());
					rows.push(row);
					row = [];
					cur = '';
				}
			} else {
				cur += ch;
			}
		}
		if (cur.length || row.length) {
			row.push(cur.trim());
			rows.push(row);
		}
		return rows.filter(r => r.some(c => c.length)); // drop empty
	}

	async function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		e.target.value = '';
		if (!file) return;

		try {
			const text = await file.text();
			const rowsForServer: Array<Record<string, any>> = [];
			const isCSV = file.name.toLowerCase().endsWith('.csv');

			if (isCSV) {
				const rows = parseCsv(text);
				if (!rows.length) throw new Error('Empty CSV');
				const headers = rows[0].map(s => s.toLowerCase());
				const dataRows = rows.slice(1);

				const idx = (name: string) => headers.findIndex(h => h === name.toLowerCase());
				const iCode = idx('code');     // optional
				const iName = idx('name');     // required
				const iAddress = idx('address');
				const iPhone = idx('phone');

				for (const r of dataRows) {
					const name = (iName >= 0 ? r[iName] : '').trim();
					if (!name) continue;
					rowsForServer.push({
						code: iCode >= 0 ? (r[iCode] || '').trim() : null,
						name,
						address: iAddress >= 0 ? (r[iAddress] || '').trim() : null,
						phone: iPhone >= 0 ? (r[iPhone] || '').trim() : null,
					});
				}
			} else {
				const json = JSON.parse(text);
				if (!Array.isArray(json)) throw new Error('File JSON must be an array');
				for (const r of json) {
					if (!r?.name) continue;
					rowsForServer.push({
						code: r.code ?? null,
						name: String(r.name),
						address: r.address ?? null,
						phone: r.phone ?? null,
					});
				}
			}

			if (!rowsForServer.length) {
				// show your dialog method here
				showDialog('Import', 'No valid rows found.');
				//alert('No valid rows found.');
				return;
			}

			const res = await fetch('/api/insurance/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ rows: rowsForServer }),
			});
			const data = await res.json().catch(() => ({}));

			if (!res.ok) {
				showDialog('Import failed', data?.error || 'Please check file format.');
				//alert(`Import failed: ${data?.error || 'Please check file format.'}`);
				return;
			}

			showDialog('Import completed', `Inserted: ${data?.inserted || 0}\nUpdated: ${data?.upserted || 0}`);
			//alert(`Import completed\nInserted: ${data?.inserted || 0}\nUpserted: ${data?.upserted || 0}`);
			await load();
		} catch (e: any) {
			showDialog('Import error', e?.message || 'Failed to import file.');
			//alert(`Import error: ${e?.message || 'Failed to import file.'}`);
		}
	}


	return (
		<div className="space-y-4">
			<Dialog open={dialog.open} title={dialog.title} message={dialog.message} onClose={() => setDialog(s => ({ ...s, open: false }))} />
			<ConfirmDialog
				open={confirmOpen}
				title="Delete Companies"
				message={`Delete ${selected.size} insurer(s)?`}
				onCancel={() => setConfirmOpen(false)}
				onConfirm={handleDeleteConfirmed}
			/>

			<div className="rounded-xl border bg-white px-5 py-4 shadow-sm flex items-center gap-3">
				<div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand-600">
					<Building2 className="h-5 w-5" />
				</div>
				<h1 className="text-2xl md:text-3xl font-bold tracking-tight">Insurance Companies</h1>
				<div className="ml-auto flex items-center gap-2">
					<input ref={fileRef} type="file" accept=".csv,application/json" className="hidden" onChange={onImportFile} />
					<button
						type="button"
						onClick={() => fileRef.current?.click()}
						className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-gray-50"
						title="Import CSV/JSON"
					>
						<Upload className="h-4 w-4" /> Import
					</button>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
				{/* Form */}
				<div className="lg:col-span-4 rounded-xl border bg-white p-4 shadow-sm">
					<div className="flex items-center justify-between mb-3">
						<h2 className="text-base font-semibold">{editingId ? 'Update Company' : 'Add New Company'}</h2>
						<button onClick={resetForm} className="text-sm text-gray-600 hover:underline">Clear</button>
					</div>

					<form onSubmit={onSubmit} className="grid grid-cols-1 gap-3">
						<div>
							<label className="block text-sm mb-1">Code</label>
							<input className="w-full border rounded px-3 py-2 bg-gray-50" value={editingId ? (code || '') : nextCode} readOnly />
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
							<label className="block text-sm mb-1">Phone</label>
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
						<h2 className="text-base font-semibold">Insurance Companies</h2>
						<div className="flex items-center gap-2">
							{anySelected && (
								<button
									type="button"
									onClick={() => setConfirmOpen(true)}
									className="inline-flex items-center justify-center rounded border p-2 text-red-600 hover:bg-red-50"
									title="Delete selected"
									aria-label="Delete selected"
								>
									<Trash2 className="h-4 w-4" />
								</button>
							)}
							<div className="relative">
								<Search className="h-4 w-4 absolute left-2 top-2.5 text-gray-400" />
								<input placeholder="Search…" className="pl-8 pr-3 py-2 border rounded w-64" value={q} onChange={(e) => setQ(e.target.value)} />
							</div>
						</div>
					</div>

					<div className="overflow-x-auto">
						<table className="min-w-full border rounded">
							<thead className="bg-gray-50">
								<tr>
									<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">
										<input type="checkbox" aria-label="Select all visible" checked={filtered.length > 0 && filtered.every(r => selected.has(r.id))} onChange={(e) => selectAllVisible(e.target.checked)} />
									</th>
									{/* CODE first, NAME second */}
									<Col k="code" label="Code" />
									<Col k="name" label="Name" />
									<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">Address</th>
									<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">Phone</th>
								</tr>
							</thead>
							<tbody>
								{loading ? (
									<tr><td colSpan={6} className="px-3 py-4 text-center text-sm text-gray-500">Loading…</td></tr>
								) : filtered.length === 0 ? (
									<tr><td colSpan={6} className="px-3 py-4 text-center text-sm text-gray-500">No companies found</td></tr>
								) : (
									filtered.map((x) => {
										const isChecked = selected.has(x.id);
										return (
											<tr key={x.id} className="border-t hover:bg-gray-50">
												<td className="px-3 py-2 text-sm">
													<input type="checkbox" checked={isChecked} onChange={(e) => toggleOne(x.id, e.target.checked)} />
												</td>
												<td className="px-3 py-2 text-sm">{x.code || ''}</td>
												<td className="px-3 py-2 text-sm">
													<button className="underline underline-offset-2" onClick={() => startEdit(x)}>{x.name}</button>
												</td>
												<td className="px-3 py-2 text-sm">{x.address || ''}</td>
												<td className="px-3 py-2 text-sm">{x.phone || ''}</td>
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
