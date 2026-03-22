// app/(app)/settings/banks/page.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
	Building2,
	Check,
	ChevronDown,
	ChevronUp,
	Search,
	Trash2,
	X,
} from 'lucide-react';

type Vendor = {
	id: string;
	vendorId: string;
	tpaName: string;
	nickName?: string | null;
};

type BankRow = {
	id: string;
	bankId: string;
	bankName: string;
	accountName: string;
	accountNo: string;
	ifsc: string;
	address: string | null;
	createdAt: string;
	vendors?: Vendor[];
	tpa?: string;
};

type SortKey = 'bankId' | 'bankName' | 'accountName' | 'createdAt';
type SortDir = 'asc' | 'desc';

function getNextBankId(rows: { bankId: string }[]) {
	let max = 0;

	for (const row of rows) {
		const raw = row.bankId || '';
		if (!raw.startsWith('BK')) continue;
		const n = parseInt(raw.slice(2), 10);
		if (!isNaN(n) && n > max) max = n;
	}

	return `BK${String(max + 1).padStart(2, '0')}`;
}

export default function ManageBanksPage() {
	const [rows, setRows] = useState<BankRow[]>([]);
	const [vendors, setVendors] = useState<Vendor[]>([]);
	const [loading, setLoading] = useState(false);

	const [editingId, setEditingId] = useState<string | null>(null);
	const [bankName, setBankName] = useState('');
	const [accountName, setAccountName] = useState('');
	const [accountNo, setAccountNo] = useState('');
	const [ifsc, setIfsc] = useState('');
	const [address, setAddress] = useState('');

	const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
	const [tpaOpen, setTpaOpen] = useState(false);
	const [tpaQuery, setTpaQuery] = useState('');
	const dropdownRef = useRef<HTMLDivElement | null>(null);

	const [formErr, setFormErr] = useState<string | null>(null);
	const [formOk, setFormOk] = useState<string | null>(null);
	const [listErr, setListErr] = useState<string | null>(null);

	const [sortKey, setSortKey] = useState<SortKey>('createdAt');
	const [sortDir, setSortDir] = useState<SortDir>('desc');
	const [q, setQ] = useState('');

	const [selected, setSelected] = useState<Set<string>>(new Set());
	const anySelected = selected.size > 0;

	useEffect(() => {
		const onDocClick = (e: MouseEvent) => {
			if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
				setTpaOpen(false);
			}
		};
		if (tpaOpen) document.addEventListener('mousedown', onDocClick);
		return () => document.removeEventListener('mousedown', onDocClick);
	}, [tpaOpen]);

	async function load() {
		setLoading(true);
		setListErr(null);
		setSelected(new Set());

		try {
			const [banksRes, vendorsRes] = await Promise.all([
				fetch('/api/banks', { cache: 'no-store' }),
				fetch('/api/vendors', { cache: 'no-store' }),
			]);

			const banksJson = await banksRes.json().catch(() => []);
			const vendorsJson = await vendorsRes.json().catch(() => []);

			if (!banksRes.ok) throw new Error(banksJson?.error || 'Load banks failed');
			if (!vendorsRes.ok) throw new Error(vendorsJson?.error || 'Load vendors failed');

			setRows(Array.isArray(banksJson) ? banksJson : []);
			setVendors(
				Array.isArray(vendorsJson)
					? vendorsJson.map((v: any) => ({
						id: v.id,
						vendorId: v.vendorId,
						tpaName: v.tpaName,
						nickName: v.nickName ?? null,
					}))
					: []
			);
		} catch (e: any) {
			setListErr(e?.message || 'Network error');
			setRows([]);
			setVendors([]);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		load();
	}, []);

	function resetForm() {
		setEditingId(null);
		setBankName('');
		setAccountName('');
		setAccountNo('');
		setIfsc('');
		setAddress('');
		setSelectedVendorIds([]);
		setTpaQuery('');
		setFormErr(null);
		setFormOk(null);
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setFormErr(null);
		setFormOk(null);

		if (!bankName.trim() || !accountName.trim() || !accountNo.trim() || !ifsc.trim()) {
			setFormErr('Please fill Bank Name, Account Name, Account No and IFSC.');
			return;
		}

		const payload = {
			bankName: bankName.trim(),
			accountName: accountName.trim(),
			accountNo: accountNo.trim(),
			ifsc: ifsc.trim().toUpperCase(),
			address: address.trim() || null,
			vendorIds: selectedVendorIds,
		};

		try {
			const res = await fetch(editingId ? `/api/banks/${editingId}` : '/api/banks', {
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

	function startEdit(r: BankRow) {
		setEditingId(r.id);
		setBankName(r.bankName);
		setAccountName(r.accountName);
		setAccountNo(r.accountNo);
		setIfsc(r.ifsc);
		setAddress(r.address || '');
		setSelectedVendorIds((r.vendors || []).map((v) => v.id));
		setTpaQuery('');
		setFormErr(null);
		setFormOk(null);
	}

	function sortBy(key: SortKey) {
		if (key === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
		else {
			setSortKey(key);
			setSortDir('asc');
		}
	}

	const filtered = useMemo(() => {
		const term = q.trim().toLowerCase();
		const base = term
			? rows.filter((r) =>
				[r.bankId, r.bankName, r.accountName, r.accountNo, r.ifsc, r.address, r.tpa]
					.filter(Boolean)
					.some((v) => String(v).toLowerCase().includes(term))
			)
			: rows;

		const sorted = [...base].sort((a, b) => {
			const va = (a[sortKey] as any) ?? '';
			const vb = (b[sortKey] as any) ?? '';
			if (va === vb) return 0;
			if (sortDir === 'asc') return va > vb ? 1 : -1;
			return va < vb ? 1 : -1;
		});

		return sorted;
	}, [rows, q, sortKey, sortDir]);

	const nextBankId = useMemo(() => getNextBankId(rows), [rows]);

	const tpaFiltered = useMemo(() => {
		const term = tpaQuery.trim().toLowerCase();
		if (!term) return vendors;
		return vendors.filter((v) =>
			[v.tpaName, v.vendorId, v.nickName]
				.filter(Boolean)
				.some((s) => String(s).toLowerCase().includes(term))
		);
	}, [vendors, tpaQuery]);

	function toggleVendor(id: string) {
		setSelectedVendorIds((prev) =>
			prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
		);
	}

	function toggleOne(id: string, checked: boolean) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (checked) next.add(id);
			else next.delete(id);
			return next;
		});
	}

	function selectAllVisible(checked: boolean) {
		if (!checked) return setSelected(new Set());
		setSelected(new Set(filtered.map((r) => r.id)));
	}

	async function deleteSelected() {
		if (!anySelected) return;
		if (!confirm(`Delete ${selected.size} bank(s)? This cannot be undone.`)) return;

		const ids = Array.from(selected);
		const results = await Promise.all(
			ids.map(async (id) => {
				try {
					const r = await fetch(`/api/banks/${id}`, { method: 'DELETE' });
					return r.ok;
				} catch {
					return false;
				}
			})
		);

		if (results.some((ok) => !ok)) setListErr('Some items could not be deleted.');
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
					{active ? (
						sortDir === 'asc' ? (
							<ChevronUp className="h-4 w-4" />
						) : (
							<ChevronDown className="h-4 w-4" />
						)
					) : null}
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
				<h1 className="text-2xl md:text-3xl font-bold tracking-tight">Manage Banks</h1>
			</div>

			<div className="rounded-xl border bg-white p-4 shadow-sm">
				<div className="flex items-center justify-between mb-3">
					<h2 className="text-base font-semibold">{editingId ? 'Update Bank' : 'Add New Bank'}</h2>
					<button onClick={resetForm} className="text-sm text-gray-600 hover:underline">
						Clear
					</button>
				</div>

				{formErr && <div className="mb-3 text-sm text-red-600">{formErr}</div>}
				{formOk && <div className="mb-3 text-sm text-green-600">{formOk}</div>}

				<form onSubmit={onSubmit} className="space-y-3">
					<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
						<div>
							<label className="block text-sm mb-1">Bank ID</label>
							<input
								className="w-full border rounded px-3 py-2 bg-gray-50"
								value={editingId ? rows.find((r) => r.id === editingId)?.bankId || '' : nextBankId}
								readOnly
							/>
						</div>
						<div>
							<label className="block text-sm mb-1">Bank Name *</label>
							<input
								className="w-full border rounded px-3 py-2"
								value={bankName}
								onChange={(e) => setBankName(e.target.value)}
							/>
						</div>
						<div>
							<label className="block text-sm mb-1">Account Name *</label>
							<input
								className="w-full border rounded px-3 py-2"
								value={accountName}
								onChange={(e) => setAccountName(e.target.value)}
							/>
						</div>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
						<div>
							<label className="block text-sm mb-1">Account No *</label>
							<input
								className="w-full border rounded px-3 py-2"
								value={accountNo}
								onChange={(e) => setAccountNo(e.target.value)}
							/>
						</div>
						<div>
							<label className="block text-sm mb-1">IFSC *</label>
							<input
								className="w-full border rounded px-3 py-2 uppercase"
								value={ifsc}
								onChange={(e) => setIfsc(e.target.value.toUpperCase())}
							/>
						</div>
						<div>
							<label className="block text-sm mb-1">Address</label>
							<input
								className="w-full border rounded px-3 py-2"
								value={address}
								onChange={(e) => setAddress(e.target.value)}
							/>
						</div>
					</div>

					<div ref={dropdownRef} className="relative">
						<label className="block text-sm mb-1">Map the TPAs</label>
						<button
							type="button"
							onClick={() => setTpaOpen((v) => !v)}
							className="w-full border rounded px-3 py-2 text-left flex items-center justify-between"
						>
							<span className="truncate">
								{selectedVendorIds.length ? `${selectedVendorIds.length} selected` : 'Search and select TPAs'}
							</span>
							<ChevronDown className="h-4 w-4 text-gray-500" />
						</button>

						{tpaOpen && (
							<div className="absolute z-20 mt-1 w-full rounded border bg-white shadow">
								<div className="p-2 border-b">
									<div className="relative">
										<Search className="h-4 w-4 absolute left-2 top-2.5 text-gray-400" />
										<input
											autoFocus
											value={tpaQuery}
											onChange={(e) => setTpaQuery(e.target.value)}
											placeholder="Search TPA by name, code, or nick…"
											className="w-full pl-8 pr-7 py-2 border rounded"
										/>
										{!!tpaQuery && (
											<button
												type="button"
												className="absolute right-1.5 top-1.5 p-1 rounded hover:bg-gray-100"
												onClick={() => setTpaQuery('')}
												aria-label="Clear search"
											>
												<X className="h-4 w-4 text-gray-500" />
											</button>
										)}
									</div>

									<div className="flex items-center gap-2 mt-2">
										<button
											type="button"
											onClick={() => {
												const ids = new Set(selectedVendorIds);
												for (const v of tpaFiltered) ids.add(v.id);
												setSelectedVendorIds(Array.from(ids));
											}}
											className="text-xs rounded border px-2 py-1 hover:bg-gray-50"
										>
											Select all (filtered)
										</button>
										<button
											type="button"
											onClick={() => setSelectedVendorIds([])}
											className="text-xs rounded border px-2 py-1 hover:bg-gray-50"
										>
											Clear all
										</button>
									</div>
								</div>

								<ul className="max-h-64 overflow-auto">
									{tpaFiltered.length === 0 ? (
										<li className="px-3 py-2 text-sm text-gray-500">No matches</li>
									) : (
										tpaFiltered.map((v) => {
											const checked = selectedVendorIds.includes(v.id);
											return (
												<li key={v.id}>
													<label className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
														<input
															type="checkbox"
															checked={checked}
															onChange={() => toggleVendor(v.id)}
														/>
														<span className="text-sm">
															<span className="font-mono text-gray-600">{v.vendorId}</span> — {v.tpaName}
															{v.nickName ? <span className="text-gray-500"> ({v.nickName})</span> : null}
														</span>
														{checked && <Check className="h-4 w-4 text-green-600 ml-auto" />}
													</label>
												</li>
											);
										})
									)}
								</ul>
							</div>
						)}
					</div>

					<div className="flex gap-2 pt-1">
						<button className="rounded bg-brand text-white px-4 py-2">
							{editingId ? 'Update' : 'Create'}
						</button>
						<button type="button" className="rounded border px-4 py-2" onClick={resetForm}>
							Reset
						</button>
					</div>
				</form>
			</div>

			<div className="rounded-xl border bg-white p-4 shadow-sm overflow-x-auto overflow-y-auto max-h-[420px]">
				<div className="flex flex-wrap items-center gap-2 justify-between mb-3">
					<h2 className="text-base font-semibold">Bank Information</h2>

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
										checked={filtered.length > 0 && filtered.every((r) => selected.has(r.id))}
										onChange={(e) => selectAllVisible(e.target.checked)}
									/>
								</th>
								<Col k="bankId" label="Bank ID" />
								<Col k="bankName" label="Bank Name" />
								<Col k="accountName" label="Account Name" />
								<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">Account No</th>
								<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">IFSC</th>
								<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">TPA List</th>
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
										No banks found
									</td>
								</tr>
							) : (
								filtered.map((r) => {
									const isChecked = selected.has(r.id);
									const tpaText =
										r.vendors?.length
											? r.vendors
												.map((v) => (v.nickName ? `${v.tpaName} (${v.nickName})` : v.tpaName))
												.join(', ')
											: (r.tpa || '');

									return (
										<tr key={r.id} className="border-t hover:bg-gray-50">
											<td className="px-3 py-2 text-sm">
												<input
													type="checkbox"
													checked={isChecked}
													onChange={(e) => toggleOne(r.id, e.target.checked)}
												/>
											</td>
											<td className="px-3 py-2 text-sm whitespace-nowrap">
												<button className="underline underline-offset-2" onClick={() => startEdit(r)}>
													{r.bankId}
												</button>
											</td>
											<td className="px-3 py-2 text-sm">{r.bankName}</td>
											<td className="px-3 py-2 text-sm">{r.accountName}</td>
											<td className="px-3 py-2 text-sm">{r.accountNo}</td>
											<td className="px-3 py-2 text-sm">{r.ifsc}</td>
											<td className="px-3 py-2 text-sm">{tpaText}</td>
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
	);
}