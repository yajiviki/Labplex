'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, Workflow, CalendarRange, Save, X, Pencil, Trash2, ChevronUp, ChevronDown, Filter, Printer } from 'lucide-react';

/* ---------- types ---------- */
type Lab = { id: string; name: string };
type Vendor = { id: string; tpaName: string };
type BillingRow = {
	id: string;
	labId: string;
	vendorId: string;
	paidDate: string; // ISO
	amount: number | string;
	status: 'Paid' | 'NotPaid';
	remarks: string | null;
	lab: { name: string };
	vendor: { tpaName: string };
};
type SortKey = 'paidDate' | 'amount' | 'status' | 'lab' | 'tpa';

/* ---------- utils ---------- */
const pad = (n: number) => String(n).padStart(2, '0');
const toYmd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const startOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

/* ---------- tiny confirm dialog ---------- */
function ConfirmDialog({ open, title, message, onConfirm, onClose }: Readonly<{
	open: boolean; title: string; message?: string; onConfirm: () => void; onClose: () => void;
}>) {
	if (!open) return null;
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<div className="absolute inset-0 bg-black/30" onClick={onClose} />
			<div className="relative z-10 w-full max-w-md rounded-xl border bg-white p-4 shadow-lg">
				<div className="flex items-center justify-between">
					<div className="text-base font-semibold">{title}</div>
					<button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X className="h-5 w-5" /></button>
				</div>
				{message && <div className="mt-2 text-sm text-gray-700">{message}</div>}
				<div className="mt-4 flex justify-end gap-2">
					<button className="rounded border px-3 py-1.5 text-sm" onClick={onClose}>Cancel</button>
					<button className="rounded bg-red-600 text-white px-3 py-1.5 text-sm" onClick={onConfirm}>Delete</button>
				</div>
			</div>
		</div>
	);
}

/* ---------- page ---------- */
export default function BillingPage() {
	// filters
	const [labs, setLabs] = useState<Lab[]>([]);
	const [vendors, setVendors] = useState<Vendor[]>([]);
	const [filterLabId, setFilterLabId] = useState('');
	const [filterVendorId, setFilterVendorId] = useState('');
	const [filterStatus, setFilterStatus] = useState<'' | 'Paid' | 'NotPaid'>('');
	const [from, setFrom] = useState(toYmd(startOfMonth()));
	const [to, setTo] = useState(toYmd(endOfMonth()));
	const [sort, setSort] = useState<SortKey>('paidDate');
	const [dir, setDir] = useState<'asc' | 'desc'>('desc');
	const [page, setPage] = useState(1);
	const [pageSize, setPageSize] = useState(50);

	// table
	const [rows, setRows] = useState<BillingRow[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(false);
	const [err, setErr] = useState<string | null>(null);

	// form
	const [formOpen, setFormOpen] = useState(true);
	const [editId, setEditId] = useState<string | null>(null);
	const [fLabId, setFLabId] = useState('');
	const [fVendorId, setFVendorId] = useState('');
	const [fPaidDate, setFPaidDate] = useState(toYmd(new Date()));
	const [fAmount, setFAmount] = useState('');
	const [fStatus, setFStatus] = useState<'Paid' | 'NotPaid'>('Paid');
	const [fRemarks, setFRemarks] = useState('');
	const [saving, setSaving] = useState(false);
	const [formErr, setFormErr] = useState<string | null>(null);
	const [vendorsForForm, setVendorsForForm] = useState<Vendor[]>([]);
	const [deleteId, setDeleteId] = useState<string | null>(null);

	// initial labs
	useEffect(() => {
		(async () => {
			const r = await fetch('/api/labs', { cache: 'no-store' });
			const data = await r.json();
			setLabs(Array.isArray(data) ? data.map((x: any) => ({ id: x.id, name: x.name })) : []);
		})();
	}, []);

	// dependent vendors for filter bar
	useEffect(() => {
		(async () => {
			if (!filterLabId) { setVendors([]); return; }
			const r = await fetch(`/api/vendors/by-lab?labId=${encodeURIComponent(filterLabId)}`, { cache: 'no-store' });
			const data = await r.json();
			setVendors(Array.isArray(data.rows) ? data.rows : []);
		})();
	}, [filterLabId]);

	// dependent vendors for form
	useEffect(() => {
		(async () => {
			if (!fLabId) { setVendorsForForm([]); setFVendorId(''); return; }
			const r = await fetch(`/api/vendors/by-lab?labId=${encodeURIComponent(fLabId)}`, { cache: 'no-store' });
			const data = await r.json();
			const list = Array.isArray(data.rows) ? data.rows : [];
			setVendorsForForm(list);
			if (fVendorId && !list.find(v => v.id === fVendorId)) setFVendorId('');
		})();
	}, [fLabId]);

	// load table
	async function load() {
		setLoading(true); setErr(null);
		try {
			const qs = new URLSearchParams();
			qs.set('from', from); qs.set('to', to);
			if (filterLabId) qs.set('labId', filterLabId);
			if (filterVendorId) qs.set('vendorId', filterVendorId);
			if (filterStatus) qs.set('status', filterStatus);
			qs.set('sort', sort === 'lab' ? 'labId' : sort === 'tpa' ? 'vendorId' : sort);
			qs.set('dir', dir);
			qs.set('page', String(page));
			qs.set('pageSize', String(pageSize));
			const r = await fetch(`/api/billing?${qs.toString()}`, { cache: 'no-store' });
			const data = await r.json();
			if (!r.ok) throw new Error(data?.error || 'Failed to load');
			setRows(Array.isArray(data.rows) ? data.rows : []);
			setTotal(Number(data.total || 0));
		} catch (e: any) {
			setErr(e?.message || 'Network error');
			setRows([]); setTotal(0);
		} finally { setLoading(false); }
	}
	useEffect(() => { load(); /* eslint-disable-next-line */ }, [from, to, filterLabId, filterVendorId, filterStatus, sort, dir, page, pageSize]);

	function resetForm() {
		setEditId(null);
		setFLabId(''); setFVendorId('');
		setFPaidDate(toYmd(new Date()));
		setFAmount(''); setFStatus('Paid');
		setFRemarks(''); setFormErr(null);
	}

	function editRow(r: BillingRow) {
		setFormOpen(true);
		setEditId(r.id);
		setFLabId(r.labId);
		setFVendorId(r.vendorId);
		setFPaidDate(toYmd(new Date(r.paidDate)));
		setFAmount(String(r.amount ?? ''));
		setFStatus(r.status);
		setFRemarks(r.remarks ?? '');
	}

	async function save() {
		try {
			setSaving(true); setFormErr(null);
			if (!fLabId || !fVendorId || !fPaidDate || !fAmount || isNaN(Number(fAmount))) {
				setFormErr('Please fill required fields correctly.'); return;
			}
			const payload = {
				labId: fLabId, vendorId: fVendorId, paidDate: fPaidDate,
				amount: Number(fAmount), status: fStatus, remarks: fRemarks || null,
			};
			let r: Response;
			if (editId) {
				r = await fetch(`/api/billing/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
			} else {
				r = await fetch('/api/billing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
			}
			const data = await r.json();
			if (!r.ok) throw new Error(data?.error || 'Save failed');
			resetForm(); load();
		} catch (e: any) {
			setFormErr(e?.message || 'Save failed');
		} finally { setSaving(false); }
	}

	async function doDelete(id: string) {
		const r = await fetch(`/api/billing/${id}`, { method: 'DELETE' });
		const data = await r.json().catch(() => ({}));
		if (!r.ok) throw new Error(data?.error || 'Delete failed');
	}

	const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="rounded-xl border bg-white p-4 shadow-sm">
				<h1 className="text-xl font-semibold">Billing → TPA</h1>
				<p className="text-sm text-gray-600 mt-1">Add / Update the Billing information</p>
			</div>

			{/* Row 1: Billing Entry Form */}
			<div className="rounded-xl border bg-white p-4 shadow-sm">
				<div className="flex items-center justify-between mb-3">
					<h2 className="text-base font-semibold">{editId ? 'Edit Billing' : 'New Billing'}</h2>
					<button className="p-1 rounded hover:bg-gray-100" onClick={() => setFormOpen(!formOpen)} aria-label="Toggle form">
						{formOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
					</button>
				</div>

				{formOpen && (
					<div className="space-y-4">
						{/* Row 1: fields in one row */}
						<div className="overflow-x-auto">
							<div className="min-w-[900px] grid grid-cols-12 gap-4 items-end">
								{/* Lab */}
								<div className="col-span-3 min-w-[200px]">
									<label className="block text-sm text-gray-600 mb-1">Lab Name</label>
									<div className="flex items-center gap-2">
										<Building2 className="h-4 w-4 text-gray-500 shrink-0" />
										<select className="border rounded px-3 py-2 w-full" value={fLabId} onChange={(e) => setFLabId(e.target.value)}>
											<option value="">Select Lab…</option>
											{labs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
										</select>
									</div>
								</div>
								{/* TPA */}
								<div className="col-span-3 min-w-[200px]">
									<label className="block text-sm text-gray-600 mb-1">TPA Name</label>
									<div className="flex items-center gap-2">
										<Workflow className="h-4 w-4 text-gray-500 shrink-0" />
										<select className="border rounded px-3 py-2 w-full" value={fVendorId} onChange={(e) => setFVendorId(e.target.value)} disabled={!fLabId}>
											<option value="">{fLabId ? 'Select TPA…' : 'Choose Lab first'}</option>
											{vendorsForForm.map(v => <option key={v.id} value={v.id}>{v.tpaName}</option>)}
										</select>
									</div>
								</div>
								{/* Paid date */}
								<div className="col-span-2 min-w-[150px]">
									<label className="block text-sm text-gray-600 mb-1">Paid date</label>
									<div className="flex items-center gap-2">
										<CalendarRange className="h-4 w-4 text-gray-500 shrink-0" />
										<input type="date" className="border rounded px-3 py-2 w-full" value={fPaidDate} onChange={(e) => setFPaidDate(e.target.value)} />
									</div>
								</div>
								{/* Amount */}
								<div className="col-span-2 min-w-[140px]">
									<label className="block text-sm text-gray-600 mb-1">Amount</label>
									<input type="number" step="0.01" className="border rounded px-3 py-2 w-full" value={fAmount} onChange={(e) => setFAmount(e.target.value)} />
								</div>
								{/* Status */}
								<div className="col-span-2 min-w-[120px]">
									<label className="block text-sm text-gray-600 mb-1">Status</label>
									<select className="border rounded px-3 py-2 w-full" value={fStatus} onChange={(e) => setFStatus(e.target.value as any)}>
										<option value="Paid">Paid</option>
										<option value="NotPaid">Not Paid</option>
									</select>
								</div>
							</div>
						</div>

						{/* Row 2: remarks */}
						<div>
							<label className="block text-sm text-gray-600 mb-1">Remarks</label>
							<textarea className="border rounded px-3 py-2 w-full" rows={2} value={fRemarks} onChange={(e) => setFRemarks(e.target.value)} />
						</div>

						{/* Errors & actions */}
						{formErr && <div className="text-sm text-red-600">{formErr}</div>}
						<div className="flex items-center justify-between">
							<div className="flex gap-2">
								<button className="inline-flex items-center gap-2 bg-brand text-white rounded px-3 py-2 text-sm disabled:opacity-50" onClick={save} disabled={saving}>
									<Save className="h-4 w-4" />
									{saving ? 'Saving…' : (editId ? 'Update' : 'Save')}
								</button>
								{editId && (
									<button className="inline-flex items-center gap-2 border rounded px-3 py-2 text-sm" onClick={resetForm}>
										<X className="h-4 w-4" /> Cancel
									</button>
								)}
							</div>
							{!editId && <div className="text-xs text-gray-500">Tip: choose Lab to load its TPA list</div>}
						</div>
					</div>
				)}
			</div>

			{/* Row 2: Filters + Table */}
			<div className="rounded-xl border bg-white p-4 shadow-sm">
				{/* Filters */}
				<div className="flex flex-wrap items-end gap-3 mb-3">
					<div className="flex flex-col">
						<label className="text-xs text-gray-600 mb-1">Lab</label>
						<div className="inline-flex items-center gap-2">
							<Building2 className="h-4 w-4 text-gray-500" />
							<select className="border rounded px-3 py-2 min-w-[220px]" value={filterLabId} onChange={(e) => { setFilterLabId(e.target.value); setFilterVendorId(''); }}>
								<option value="">All Labs</option>
								{labs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
							</select>
						</div>
					</div>

					<div className="flex flex-col">
						<label className="text-xs text-gray-600 mb-1">TPA</label>
						<div className="inline-flex items-center gap-2">
							<Workflow className="h-4 w-4 text-gray-500" />
							<select className="border rounded px-3 py-2 min-w-[220px]" value={filterVendorId} onChange={(e) => setFilterVendorId(e.target.value)} disabled={!filterLabId}>
								<option value="">{filterLabId ? 'All TPA' : 'Choose Lab first'}</option>
								{vendors.map(v => <option key={v.id} value={v.id}>{v.tpaName}</option>)}
							</select>
						</div>
					</div>

					<div className="flex flex-col">
						<label className="text-xs text-gray-600 mb-1">Status</label>
						<select className="border rounded px-3 py-2 min-w-[140px]" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}>
							<option value="">All</option>
							<option value="Paid">Paid</option>
							<option value="NotPaid">NotPaid</option>
						</select>
					</div>

					<div className="flex flex-col">
						<label className="text-xs text-gray-600 mb-1">From</label>
						<input type="date" className="border rounded px-3 py-2" value={from} onChange={(e) => setFrom(e.target.value)} />
					</div>
					<div className="flex flex-col">
						<label className="text-xs text-gray-600 mb-1">To</label>
						<input type="date" className="border rounded px-3 py-2" value={to} onChange={(e) => setTo(e.target.value)} />
					</div>

					<button className="ml-auto inline-flex items-center gap-2 border rounded px-3 py-2 text-sm" onClick={() => load()} title="Apply filters">
						<Filter className="h-4 w-4" /> Apply
					</button>
				</div>

				{/* Table */}
				<div className="border rounded overflow-x-auto">
					<table className="min-w-[980px] text-sm">
						<thead className="bg-gray-50">
							<tr>
								<Th label="Paid date" k="paidDate" sort={sort} dir={dir} onSort={setSort} onDir={setDir} />
								<Th label="Lab" k="lab" sort={sort} dir={dir} onSort={setSort} onDir={setDir} />
								<Th label="TPA" k="tpa" sort={sort} dir={dir} onSort={setSort} onDir={setDir} />
								<Th label="Amount" k="amount" sort={sort} dir={dir} onSort={setSort} onDir={setDir} align="right" />
								<Th label="Status" k="status" sort={sort} dir={dir} onSort={setSort} onDir={setDir} />
								<th className="px-3 py-2 text-left font-semibold">Remarks</th>
								<th className="px-3 py-2 text-right font-semibold">Actions</th>
							</tr>
						</thead>
						<tbody>
							{loading ? (
								<tr><td colSpan={7} className="px-3 py-4 text-center">Loading…</td></tr>
							) : rows.length === 0 ? (
								<tr><td colSpan={7} className="px-3 py-4 text-center text-gray-500">No data</td></tr>
							) : (
								rows.map(r => (
									<tr key={r.id} className="border-top border-t">
										<td className="px-3 py-2 whitespace-nowrap">{new Date(r.paidDate).toLocaleDateString()}</td>
										<td className="px-3 py-2">{r.lab?.name || ''}</td>
										<td className="px-3 py-2">{r.vendor?.tpaName || ''}</td>
										<td className="px-3 py-2 text-right">₹{Number(r.amount).toLocaleString()}</td>
										<td className="px-3 py-2">{r.status}</td>
										<td className="px-3 py-2">{r.remarks || ''}</td>
										<td className="px-3 py-2 text-right">
											<div className="inline-flex gap-2">
												<button className="p-1 rounded hover:bg-gray-100" onClick={() => editRow(r)} title="Edit"><Pencil className="h-4 w-4" /></button>
												<button
													className="p-1 rounded hover:bg-gray-100"
													onClick={() => window.open(`/billing/receipt/${r.id}`, '_blank', 'noopener')}
													title="Print receipt"
												>
													<Printer className="h-4 w-4" />
												</button>
												<button className="p-1 rounded hover:bg-gray-100 text-red-600" onClick={() => setDeleteId(r.id)} title="Delete"><Trash2 className="h-4 w-4" /></button>
											</div>
										</td>
									</tr>
								))
							)}
						</tbody>
					</table>
				</div>

				{/* Pagination */}
				<div className="mt-3 flex items-center justify-between">
					<div className="text-sm text-gray-600">Total: {total.toLocaleString()}</div>
					<div className="flex items-center gap-2">
						<select className="border rounded px-2 py-1 text-sm" value={pageSize} onChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(1); }}>
							{[25, 50, 100, 200].map(n => <option key={n} value={n}>{n} / page</option>)}
						</select>
						<button className="border rounded px-2 py-1 text-sm disabled:opacity-50" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
						<div className="text-sm px-2">Page {page} / {totalPages}</div>
						<button className="border rounded px-2 py-1 text-sm disabled:opacity-50" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
					</div>
				</div>

				{err && <div className="mt-3 text-sm text-red-600">{err}</div>}
			</div>

			{/* Delete dialog */}
			<ConfirmDialog
				open={!!deleteId}
				title="Delete this billing record?"
				message="This will remove the record."
				onClose={() => setDeleteId(null)}
				onConfirm={async () => {
					if (!deleteId) return;
					try { await doDelete(deleteId); } catch (e: any) { /* you can surface error if needed */ }
					setDeleteId(null); load();
				}}
			/>
		</div>
	);
}

/* ---------- tiny sortable th ---------- */
function Th({
	label, k, sort, dir, onSort, onDir, align = 'left',
}: { label: string; k: any; sort: any; dir: 'asc' | 'desc'; onSort: (k: any) => void; onDir: (d: 'asc' | 'desc') => void; align?: 'left' | 'right' }) {
	const active = sort === k;
	return (
		<th
			className={`px-3 py-2 text-${align} font-semibold cursor-pointer select-none`}
			onClick={() => { if (active) onDir(dir === 'asc' ? 'desc' : 'asc'); else { onSort(k); onDir('asc'); } }}
			title="Sort"
		>
			<div className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end w-full' : ''}`}>
				<span>{label}</span>
				{active ? (dir === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : null}
			</div>
		</th>
	);
}
