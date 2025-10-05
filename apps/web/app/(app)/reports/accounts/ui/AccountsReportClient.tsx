'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, Workflow, CalendarRange, Undo2, X, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from 'recharts';

type LabLite = { id: string; name: string };
type VendorLite = { id: string; tpaName: string };

// === include nick names + missing count ===
type TableRow = {
	labId: string | null;
	labName: string;
	labNickName?: string | null;
	vendorId: string | null;
	tpaName: string;
	tpaNickName?: string | null;
	totalExtra: number;
	missingExtraCount: number;
};
type TrendRow = { date: string; amount: number };

// ---------- PIVOT TYPES ----------
type PivotRow = {
	vendorId: string | null;
	tpaName: string;
	labId: string | null;
	labName: string;
	localTotal: number;
	outerTotal: number;
	rowTotal: number;
	cells: Record<string, number>; // key = `${serviceType}__${visitType}__${gender}`
};
type PivotPayload = {
	serviceTypes: string[];
	visits: string[];
	genders: string[];
	rows: PivotRow[];
	totalLocal: number;
	totalOuter: number;
	grandTotal: number;
	columnTotals: Record<string, number>;
};

type PresetKey =
	| 'today' | 'yesterday' | 'prev-week' | 'prev-7' | 'prev-30'
	| 'this-month' | 'prev-month' | 'prev-3m' | 'prev-12m';

// ----- date helpers -----
function toYmd(d: Date) {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function endOfToday() { const d = new Date(); d.setHours(23, 59, 59, 999); return d; }
function startOfWeekMonday(d = new Date()) { const x = new Date(d); const dow = (x.getDay() + 6) % 7; x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - dow); return x; }
function endOfWeekFromStart(s: Date) { const e = new Date(s); e.setDate(s.getDate() + 6); e.setHours(23, 59, 59, 999); return e; }

export default function AccountsReportClient({
	labs, vendors, initialFrom, initialTo, initialLabId, initialVendorId, initialData,
}: {
	labs: LabLite[];
	vendors: VendorLite[];
	initialFrom: string;
	initialTo: string;
	initialLabId: string;
	initialVendorId: string;
	initialData: { table: TableRow[]; trend: TrendRow[]; pivot?: PivotPayload };
}) {
	// Toolbar filters (for summary & trend)
	const [labId, setLabId] = useState<string>(initialLabId ?? '');
	const [vendorId, setVendorId] = useState<string>(initialVendorId ?? '');
	const [from, setFrom] = useState<string>(initialFrom);
	const [to, setTo] = useState<string>(initialTo);
	const [preset, setPreset] = useState<PresetKey | ''>('');

	// Focused trend (when clicking a summary row)
	const [focused, setFocused] = useState<{ labId: string | null; vendorId: string | null } | null>(null);

	const [loading, setLoading] = useState(false);
	const [err, setErr] = useState<string | null>(null);

	const [table, setTable] = useState<TableRow[]>(Array.isArray(initialData?.table) ? initialData.table : []);
	const [trend, setTrend] = useState<TrendRow[]>(Array.isArray(initialData?.trend) ? initialData.trend : []);
	const [pivot, setPivot] = useState<PivotPayload | null>(initialData?.pivot ?? null);

	// ---------- Pivot Lab multi-select state ----------
	const [pivotLabOpen, setPivotLabOpen] = useState(false);
	const [pivotLabIds, setPivotLabIds] = useState<string[]>([]); // selected labs for pivot

	// default: all labs EXCEPT “Vignash Lab”
	useEffect(() => {
		if (!labs?.length) return;
		const deselectName = 'vignash lab';
		const initial = labs.filter(l => (l.name || '').toLowerCase() !== deselectName).map(l => l.id);
		setPivotLabIds(initial);
	}, [labs]);

	const pivotSelectedLabel = useMemo(() => {
		if (!pivotLabIds.length) return '0 selected';
		if (pivotLabIds.length === labs.length) return 'All labs';
		if (pivotLabIds.length === 1) return labs.find(l => l.id === pivotLabIds[0])?.name || '1 selected';
		return `${pivotLabIds.length} selected`;
	}, [pivotLabIds, labs]);

	function togglePivotLab(id: string, checked: boolean) {
		setPivotLabIds(prev => checked ? Array.from(new Set([...prev, id])) : prev.filter(x => x !== id));
	}
	function toggleAllPivotLabs(selectAll: boolean) {
		if (selectAll) setPivotLabIds(labs.map(l => l.id));
		else setPivotLabIds([]);
	}

	// ---------- DETAIL MODAL ----------
	type DetailRow = {
		id: string;
		apptAt: string;
		labName: string | null;
		tpaName: string | null;
		insuranceNickName: string | null; // new
		clientName: string | null;
		gender: string | null;
		status: string | null;
		visitType: string | null;
		serviceType: string | null;
		extraChargeRs: number | null; // new
	};
	const [detailOpen, setDetailOpen] = useState(false);
	const [detailTitle, setDetailTitle] = useState('');
	const [detailRows, setDetailRows] = useState<DetailRow[]>([]);
	const [detailLoading, setDetailLoading] = useState(false);
	const [detailErr, setDetailErr] = useState<string | null>(null);
	type DetailSortKey =
		| 'apptAt' | 'labName' | 'tpaName' | 'insuranceNickName'
		| 'clientName' | 'gender' | 'status' | 'visitType' | 'serviceType' | 'extraChargeRs';
	const [dSortKey, setDSortKey] = useState<DetailSortKey>('apptAt');
	const [dSortDir, setDSortDir] = useState<'asc' | 'desc'>('desc');

	const sortedDetailRows = useMemo(() => {
		const arr = [...detailRows];
		arr.sort((a, b) => {
			const va = (a[dSortKey] ?? '') as any;
			const vb = (b[dSortKey] ?? '') as any;
			if (va === vb) return 0;
			const cmp = va > vb ? 1 : -1;
			return dSortDir === 'asc' ? cmp : -cmp;
		});
		return arr;
	}, [detailRows, dSortKey, dSortDir]);

	function toggleDSort(k: DetailSortKey) {
		if (k === dSortKey) setDSortDir(dSortDir === 'asc' ? 'desc' : 'asc');
		else { setDSortKey(k); setDSortDir('asc'); }
	}

	const chartTitle = useMemo(() => {
		const curLabId = focused ? (focused.labId || '') : (labId || '');
		const curVenId = focused ? (focused.vendorId || '') : (vendorId || '');
		const labLbl = curLabId ? (labs.find(l => l.id === curLabId)?.name ?? 'Selected Lab') : 'All Labs';
		const tpaLbl = curVenId ? (vendors.find(v => v.id === curVenId)?.tpaName ?? 'Selected TPA') : 'All TPA';
		return `Amount Trend (${labLbl}, ${tpaLbl})`;
	}, [focused, labId, vendorId, labs, vendors]);

	function applyPreset(p: PresetKey) {
		const now = new Date();
		let f: Date; let t: Date;
		switch (p) {
			case 'today': f = startOfToday(); t = endOfToday(); break;
			case 'yesterday': f = startOfToday(); f.setDate(f.getDate() - 1); t = endOfToday(); t.setDate(t.getDate() - 1); break;
			case 'prev-week': { const s = startOfWeekMonday(now); f = new Date(s); f.setDate(s.getDate() - 7); t = endOfWeekFromStart(f); break; }
			case 'prev-7': t = endOfToday(); f = new Date(t); f.setDate(t.getDate() - 6); f.setHours(0, 0, 0, 0); break;
			case 'prev-30': t = endOfToday(); f = new Date(t); f.setDate(t.getDate() - 29); f.setHours(0, 0, 0, 0); break;
			case 'this-month': { const y = now.getFullYear(), m = now.getMonth(); f = new Date(y, m, 1, 0, 0, 0, 0); t = new Date(y, m + 1, 0, 23, 59, 59, 999); break; }
			case 'prev-month': { const y = now.getFullYear(), m = now.getMonth(); f = new Date(y, m - 1, 1, 0, 0, 0, 0); t = new Date(y, m, 0, 23, 59, 59, 999); break; }
			case 'prev-3m': { const y = now.getFullYear(), m = now.getMonth(); f = new Date(y, m - 3, 1, 0, 0, 0, 0); t = new Date(y, m, 0, 23, 59, 59, 999); break; }
			case 'prev-12m': { const y = now.getFullYear(), m = now.getMonth(); f = new Date(y, m - 12, 1, 0, 0, 0, 0); t = new Date(y, m, 0, 23, 59, 59, 999); break; }
		}
		setPreset(p);
		setFrom(toYmd(f));
		setTo(toYmd(t));
	}

	// Loader (summary/trend use single lab/vendor; pivot also receives multi-lab list)
	async function load() {
		setLoading(true); setErr(null);
		try {
			const effLabId = focused ? (focused.labId || null) : (labId || null);
			const effVenId = focused ? (focused.vendorId || null) : (vendorId || null);

			const res = await fetch('/api/reports/accounts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ labId: effLabId, vendorId: effVenId, from, to, pivotLabIds }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data?.error || 'Failed to load');

			setTable(Array.isArray(data.table) ? data.table : []);
			setTrend(Array.isArray(data.trend) ? data.trend : []);
			setPivot(data.pivot ?? null);
		} catch (e: any) {
			setErr(e?.message || 'Network error');
			setTable([]); setTrend([]); setPivot(null);
		} finally { setLoading(false); }
	}
	useEffect(() => { load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [labId, vendorId, from, to, focused, pivotLabIds]);

	function focusRow(r: TableRow) { setFocused({ labId: r.labId ?? null, vendorId: r.vendorId ?? null }); }
	function clearFocus() { setFocused(null); }

	// ---------- headers for pivot ----------
	const visitLabel = (v: string) => (v === 'HOME' ? 'Home Visit' : v === 'CENTER' ? 'Center Visit' : v);
	const pivotKeysDetailed: string[] = useMemo(() => {
		if (!pivot) return [];
		const keys: string[] = [];
		for (const st of pivot.serviceTypes) for (const vt of pivot.visits) for (const g of pivot.genders) {
			keys.push(`${st}__${vt}__${g}`);
		}
		return keys;
	}, [pivot]);

	// ---------- DETAIL MODAL loader (supports extraMissing) ----------
	async function openDetails(title: string, filters: {
		labId?: string | null;
		vendorId?: string | null;
		serviceType?: string | null;
		visitType?: string | null;
		gender?: string | null;
		extraMissing?: boolean; // new
	}) {
		setDetailTitle(title);
		setDetailOpen(true);
		setDetailLoading(true);
		setDetailErr(null);
		setDetailRows([]);
		try {
			const res = await fetch('/api/reports/accounts/details', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ from, to, ...filters }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data?.error || 'Failed to load details');
			setDetailRows(Array.isArray(data?.rows) ? data.rows : []);
		} catch (e: any) {
			setDetailErr(e?.message || 'Network error');
		} finally { setDetailLoading(false); }
	}

	// ---------- Download helpers ----------
	function toDelimited(rows: any[], headers: { key: string; label: string }[], sep: string) {
		const escape = (v: any) => {
			const s = v == null ? '' : String(v);
			if (sep === '\t') return s.replace(/\r?\n/g, ' ');
			const needsQuotes = /[",\r\n]/.test(s);
			const escaped = s.replace(/"/g, '""');
			return needsQuotes ? `"${escaped}"` : escaped;
		};
		const header = headers.map(h => escape(h.label)).join(sep);
		const lines = rows.map(r => headers.map(h => escape((r as any)[h.key])).join(sep));
		return [header, ...lines].join('\r\n');
	}
	function downloadBlob(data: string, mime: string, filename: string) {
		const blob = new Blob([data], { type: mime });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url; a.download = filename; document.body.appendChild(a);
		a.click();
		setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
	}

	// Export ALL missing-extra rows (based on current toolbar filters) from the summary card icon
	async function exportAllMissingCSV() {
		try {
			// honor current toolbar filters; ignore focused state to export the whole filtered slice
			const effLabId = labId || null;
			const effVenId = vendorId || null;
			const res = await fetch('/api/reports/accounts/details', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ from, to, labId: effLabId, vendorId: effVenId, extraMissing: true }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data?.error || 'Failed to load details for CSV');

			const rows = Array.isArray(data?.rows) ? data.rows : [];
			const headers = [
				{ key: 'apptAt', label: 'App. Date' },
				{ key: 'tpaName', label: 'TPA Name' },
				{ key: 'labName', label: 'Lab Name' },
				{ key: 'insuranceNickName', label: 'Insurance Nick name' },
				{ key: 'clientName', label: 'Client Name' },
				{ key: 'status', label: 'Status' },
				{ key: 'visitType', label: 'Visit Type' },
				{ key: 'serviceType', label: 'Service Type' },
				{ key: 'extraChargeRs', label: 'Extra Amount' },
			];
			const normalized = rows.map((r: any) => ({
				...r,
				apptAt: new Date(r.apptAt).toLocaleDateString(),
				extraChargeRs: r.extraChargeRs != null ? r.extraChargeRs : '',
			}));
			const csv = toDelimited(normalized, headers, ',');
			downloadBlob(csv, 'text/csv;charset=utf-8', 'missing-extra-appointments.csv');
		} catch (e) {
			alert((e as any)?.message || 'Failed to export CSV');
		}
	}

	// Detail modal CSV (kept for when you open a slice)
	function downloadCSV() {
		const headers = [
			{ key: 'apptAt', label: 'App. Date' },
			{ key: 'tpaName', label: 'TPA Name' },
			{ key: 'labName', label: 'Lab Name' },
			{ key: 'insuranceNickName', label: 'Insurance Nick name' },
			{ key: 'clientName', label: 'Client Name' },
			{ key: 'status', label: 'Status' },
			{ key: 'visitType', label: 'Visit Type' },
			{ key: 'serviceType', label: 'Service Type' },
			{ key: 'extraChargeRs', label: 'Extra Amount' },
		];
		const rows = sortedDetailRows.map(r => ({
			...r,
			apptAt: new Date(r.apptAt).toLocaleDateString(),
			extraChargeRs: r.extraChargeRs != null ? r.extraChargeRs : '',
		}));
		const csv = toDelimited(rows, headers, ',');
		downloadBlob(csv, 'text/csv;charset=utf-8', 'appointments.csv');
	}

	const overallMissingCount = useMemo(() => table.reduce((s, r) => s + (r.missingExtraCount || 0), 0), [table]);

	// ====== SUMMARY TABLE SORTING ======
	type SummarySortKey = 'tpa' | 'lab' | 'amount' | 'missing';
	const [sSortKey, setSSortKey] = useState<SummarySortKey>('tpa');
	const [sSortDir, setSSortDir] = useState<'asc' | 'desc'>('asc');

	function toggleSummarySort(k: SummarySortKey) {
		if (k === sSortKey) setSSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
		else { setSSortKey(k); setSSortDir('asc'); }
	}

	const sortedTable: TableRow[] = useMemo(() => {
		const arr = [...table];
		const safeStr = (v: string | null | undefined) => (v ?? '').toString().toLowerCase();
		arr.sort((a, b) => {
			let cmp = 0;
			if (sSortKey === 'tpa') {
				const av = safeStr(a.tpaNickName ?? a.tpaName);
				const bv = safeStr(b.tpaNickName ?? b.tpaName);
				cmp = av > bv ? 1 : av < bv ? -1 : 0;
			} else if (sSortKey === 'lab') {
				const av = safeStr(a.labNickName ?? a.labName);
				const bv = safeStr(b.labNickName ?? b.labName);
				cmp = av > bv ? 1 : av < bv ? -1 : 0;
			} else if (sSortKey === 'amount') {
				const av = a.totalExtra ?? 0;
				const bv = b.totalExtra ?? 0;
				cmp = av - bv;
			} else if (sSortKey === 'missing') {
				const av = a.missingExtraCount ?? 0;
				const bv = b.missingExtraCount ?? 0;
				cmp = av - bv;
			}
			return sSortDir === 'asc' ? cmp : -cmp;
		});
		return arr;
	}, [table, sSortKey, sSortDir]);

	const SummarySortHdr = ({ k, align = 'left', children }: { k: SummarySortKey; align?: 'left' | 'right'; children: React.ReactNode }) => {
		const active = sSortKey === k;
		return (
			<th
				className={`px-3 py-2 text-${align} font-semibold cursor-pointer select-none`}
				onClick={() => toggleSummarySort(k)}
				title="Sort"
			>
				<div className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end w-full' : ''}`}>
					<span>{children}</span>
					{active ? (sSortDir === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : null}
				</div>
			</th>
		);
	};

	const SortHdr = ({ k, children }: { k: DetailSortKey; children: React.ReactNode }) => {
		const active = dSortKey === k;
		return (
			<th
				className="px-3 py-2 text-left text-sm font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap"
				onClick={() => toggleDSort(k)}
				title="Sort"
			>
				<div className="inline-flex items-center gap-1">
					<span>{children}</span>
					{active ? (dSortDir === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : null}
				</div>
			</th>
		);
	};

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="rounded-xl border bg-white p-4 shadow-sm">
				<h1 className="text-xl font-semibold">Reports → Accounts</h1>
				<p className="text-sm text-gray-600 mt-1">Extra amount (Rs) summary &amp; daily trend.</p>
			</div>

			{/* Toolbar */}
			<div className="-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/90">
				<div className="rounded-none border-x-0 border-t border-b bg-white p-4 shadow-sm w-full">
					<div className="flex flex-wrap items-end gap-3">
						{/* Lab (single) */}
						<div className="flex flex-col">
							<label className="text-xs text-gray-600 mb-1">Lab</label>
							<div className="inline-flex items-center gap-2">
								<Building2 className="h-4 w-4 text-gray-500" />
								<select className="border rounded px-3 py-2 min-w-[220px]" value={labId} onChange={(e) => setLabId(e.target.value)}>
									<option value="">All Labs</option>
									{labs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
								</select>
							</div>
						</div>

						{/* TPA */}
						<div className="flex flex-col">
							<label className="text-xs text-gray-600 mb-1">TPA</label>
							<div className="inline-flex items-center gap-2">
								<Workflow className="h-4 w-4 text-gray-500" />
								<select className="border rounded px-3 py-2 min-w-[220px]" value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
									<option value="">All TPA</option>
									{vendors.map(v => <option key={v.id} value={v.id}>{v.tpaName}</option>)}
								</select>
							</div>
						</div>

						{/* Date range */}
						<div className="flex flex-col">
							<label className="text-xs text-gray-600 mb-1">From</label>
							<div className="inline-flex items-center gap-2">
								<CalendarRange className="h-4 w-4 text-gray-500" />
								<input type="date" className="border rounded px-3 py-2" value={from} onChange={(e) => { setPreset(''); setFrom(e.target.value); }} />
							</div>
						</div>
						<div className="flex flex-col">
							<label className="text-xs text-gray-600 mb-1">To</label>
							<input type="date" className="border rounded px-3 py-2" value={to} onChange={(e) => { setPreset(''); setTo(e.target.value); }} />
						</div>

						{/* Quick range */}
						<div className="flex flex-col">
							<label className="text-xs text-gray-600 mb-1">Quick range</label>
							<select className="border rounded px-3 py-2 min-w-[220px]" value={preset} onChange={(e) => applyPreset(e.target.value as PresetKey)}>
								<option value="">Select…</option>
								<option value="today">Today</option>
								<option value="yesterday">Yesterday</option>
								<option value="prev-week">Previous week</option>
								<option value="prev-7">Previous 7 days</option>
								<option value="prev-30">Previous 30 days</option>
								<option value="this-month">This month</option>
								<option value="prev-month">Previous month</option>
								<option value="prev-3m">Previous 3 months</option>
								<option value="prev-12m">Previous 12 months</option>
							</select>
						</div>

						<button type="button" onClick={() => load()} className="ml-auto bg-brand text-white rounded px-3 py-2 text-sm" disabled={loading}>
							{loading ? 'Loading…' : 'Apply'}
						</button>
					</div>
					{err && <div className="mt-3 text-sm text-red-600">{err}</div>}
				</div>
			</div>

			{/* Table + Chart */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
				{/* Summary + table */}
				<div className="rounded-xl border bg-white p-4 shadow-sm lg:col-span-1">
					<div className="flex items-center justify-between mb-3">
						<h3 className="font-semibold">Extra Amount Summary</h3>
						{/* Download ALL missing as CSV (based on current toolbar filters) */}
						<button
							type="button"
							onClick={exportAllMissingCSV}
							className="inline-flex items-center gap-2 text-sm px-2.5 py-1.5 border rounded hover:bg-gray-50"
							title="Download all missing-extra appointments (CSV)"
						>
							<Download className="h-4 w-4" />
							Download
						</button>
					</div>
					<div className="overflow-x-auto">
						<div className="border rounded max-h-60 overflow-y-auto">
							<table className="min-w-full text-sm">
								<thead className="bg-gray-50 sticky top-0 z-10">
									<tr>
										{/* Sortable headers */}
										<SummarySortHdr k="tpa">TPA</SummarySortHdr>
										<SummarySortHdr k="lab">Lab</SummarySortHdr>
										<SummarySortHdr k="amount" align="right">Amount (₹)</SummarySortHdr>
										<SummarySortHdr k="missing" align="right">Missing Cnt</SummarySortHdr>
									</tr>
								</thead>
								<tbody>
									{loading ? (
										<tr><td className="px-3 py-4 text-center" colSpan={4}>Loading…</td></tr>
									) : sortedTable.length === 0 ? (
										<tr><td className="px-3 py-4 text-center text-gray-500" colSpan={4}>No data</td></tr>
									) : (
										sortedTable.map((r, idx) => (
											<tr
												key={`${r.vendorId ?? 'all'}-${r.labId ?? 'all'}-${idx}`}
												className="border-t hover:bg-gray-50"
											>
												<td className="px-3 py-2 cursor-pointer" onClick={() => focusRow(r)} title="Focus trend on this TPA/Lab">
													{r.tpaNickName ?? r.tpaName}
												</td>
												<td className="px-3 py-2 cursor-pointer" onClick={() => focusRow(r)} title="Focus trend on this TPA/Lab">
													{r.labNickName ?? r.labName}
												</td>
												<td className="px-3 py-2 text-right">₹{(r.totalExtra ?? 0).toLocaleString()}</td>
												<td
													className="px-3 py-2 text-right cursor-pointer hover:underline"
													title="Show details without extra amount"
													onClick={() => openDetails(
														`${r.tpaNickName ?? r.tpaName} → ${r.labNickName ?? r.labName} • No Extra Amount`,
														{ vendorId: r.vendorId, labId: r.labId, extraMissing: true }
													)}
												>
													{(r.missingExtraCount ?? 0).toLocaleString()}
												</td>
											</tr>
										))
									)}
								</tbody>
								{/* no totals row per request */}
							</table>
						</div>
					</div>
					<div className="mt-2 text-xs text-gray-800 mb-3">
						Overall Missing: <span className="font-semibold">{overallMissingCount.toLocaleString()}</span>
					</div>
				</div>

				{/* Trend */}
				<div className="rounded-xl border bg-white p-4 shadow-sm lg:col-span-2">
					<div className="flex items-center justify-between mb-3">
						<h3 className="text-base font-semibold">{chartTitle}</h3>
						{focused && (
							<button type="button" onClick={clearFocus} className="inline-flex items-center gap-1.5 text-sm px-2.5 py-1.5 border rounded hover:bg-gray-50">
								<Undo2 className="h-4 w-4" />
								Back to filtered trend
							</button>
						)}
					</div>
					<div className="h-72">
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart data={Array.isArray(trend) ? trend : []}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="date" />
								<YAxis allowDecimals={false} />
								<Tooltip formatter={(v: any) => `₹${Number(v).toLocaleString()}`} />
								<Legend />
								<Area type="monotone" dataKey="amount" name="Amount" stroke="#0EA5E9" fill="#0EA5E9" fillOpacity={0.2} fontSize={8} />
							</AreaChart>
						</ResponsiveContainer>
					</div>
				</div>
			</div>

			{/* ---------- PIVOT (counts) — with multi-select Labs filter on header ---------- */}
			<div className="rounded-xl border bg-white p-4 shadow-sm">
				<div className="flex items-center justify-between mb-3">
					<h3 className="text-base font-semibold">Appointments Informations</h3>

					{/* Pivot Lab multi-select */}
					<div className="relative">
						<button
							type="button"
							className="inline-flex items-center gap-2 border rounded px-3 py-1.5 text-sm"
							onClick={() => setPivotLabOpen(v => !v)}
							title="Filter labs for Pivot table"
						>
							<Building2 className="h-4 w-4" />
							Labs: {pivotSelectedLabel}
							<ChevronDown className="h-4 w-4 opacity-70" />
						</button>

						{pivotLabOpen && (
							<div className="absolute right-0 z-20 mt-1 w-72 rounded border bg-white shadow p-2">
								<div className="flex items-center justify-between px-2 py-1">
									<button className="text-xs underline" onClick={() => toggleAllPivotLabs(true)}>Select all</button>
									<button className="text-xs underline" onClick={() => toggleAllPivotLabs(false)}>Clear</button>
								</div>
								<div className="max-h-64 overflow-y-auto pr-1">
									{labs.map(l => {
										const checked = pivotLabIds.includes(l.id);
										return (
											<label key={l.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer">
												<input type="checkbox" checked={checked} onChange={(e) => togglePivotLab(l.id, e.target.checked)} />
												<span className="text-sm">{l.name}</span>
											</label>
										);
									})}
								</div>
								<div className="pt-2 flex justify-end gap-2">
									<button className="border rounded px-3 py-1.5 text-sm" onClick={() => setPivotLabOpen(false)}>Close</button>
								</div>
							</div>
						)}
					</div>
				</div>

				{pivot && (
					<div className="text-sm text-gray-600 mb-2">
						Over all Cases: <span className="font-semibold">{pivot.grandTotal.toLocaleString()}</span>
					</div>
				)}

				{!pivot ? (
					<div className="text-sm text-gray-500">No data</div>
				) : (
					<div className="w-full overflow-x-auto">
						<div className="max-h-[520px] overflow-y-auto border rounded">
							<table className="min-w-[1200px] text-sm">
								<thead className="bg-gray-50 sticky top-0 z-10">
									<tr>
										<th className="px-3 py-2 text-left font-semibold">TPA NAME</th>
										<th className="px-3 py-2 text-left font-semibold">LAB NAME</th>
										<th className="px-3 py-2 text-right font-semibold">Local</th>
										<th className="px-3 py-2 text-right font-semibold">Outer</th>
										<th className="px-3 py-2 text-right font-semibold">Total cases (Local + Outer)</th>
										{pivot.serviceTypes.map(st => (
											pivot.visits.map(vt => (
												<th key={`${st}__${vt}`} className="px-3 py-2 text-center font-semibold" colSpan={pivot.genders.length}>
													{st} Cases ({visitLabel(vt)})
												</th>
											))
										))}
									</tr>
									<tr className="bg-gray-50 sticky top-[33px] z-10">
										<th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Gender</th>
										<th className="px-3 py-2 text-left text-xs font-medium text-gray-600" />
										<th className="px-3 py-2 text-right text-xs font-medium text-gray-600" />
										<th className="px-3 py-2 text-right text-xs font-medium text-gray-600" />
										<th className="px-3 py-2 text-right text-xs font-medium text-gray-600" />
										{pivot.serviceTypes.flatMap(st =>
											pivot.visits.flatMap(vt =>
												pivot.genders.map(g => (
													<th key={`${st}__${vt}__${g}`} className="px-3 py-1.5 text-center text-xs font-medium text-gray-600">
														{g}
													</th>
												))
											)
										)}
									</tr>
								</thead>
								<tbody>
									{pivot.rows.length === 0 ? (
										<tr><td colSpan={5 + pivotKeysDetailed.length} className="px-3 py-4 text-center text-gray-500">No data</td></tr>
									) : (
										pivot.rows.map((r, idx) => (
											<tr key={`${r.vendorId ?? 'all'}-${r.labId ?? 'all'}-${idx}`} className="border-t hover:bg-gray-50">
												<td className="px-3 py-2">{r.tpaName}</td>
												<td className="px-3 py-2">{r.labName}</td>

												{/* Local (clickable) */}
												<td
													className="px-3 py-2 text-right cursor-pointer hover:underline"
													title="Show details"
													onClick={() => openDetails(`${r.tpaName} → ${r.labName} • Local`, { vendorId: r.vendorId, labId: r.labId, serviceType: 'Local' })}
												>
													{r.localTotal.toLocaleString()}
												</td>

												{/* Outer (clickable) */}
												<td
													className="px-3 py-2 text-right cursor-pointer hover:underline"
													title="Show details"
													onClick={() => openDetails(`${r.tpaName} → ${r.labName} • Outer`, { vendorId: r.vendorId, labId: r.labId, serviceType: 'Outer' })}
												>
													{r.outerTotal.toLocaleString()}
												</td>

												{/* Row total (clickable) */}
												<td
													className="px-3 py-2 text-right font-medium cursor-pointer hover:underline"
													title="Show details"
													onClick={() => openDetails(`${r.tpaName} → ${r.labName} • Total`, { vendorId: r.vendorId, labId: r.labId })}
												>
													{r.rowTotal.toLocaleString()}
												</td>

												{/* Detailed gender cells (clickable) */}
												{pivotKeysDetailed.map((k) => {
													const [st, vt, g] = k.split('__');
													return (
														<td
															key={k}
															className="px-3 py-2 text-center cursor-pointer hover:underline"
															title="Show details"
															onClick={() => openDetails(`${r.tpaName} → ${r.labName} • ${st} • ${visitLabel(vt)} • ${g}`, {
																vendorId: r.vendorId,
																labId: r.labId,
																serviceType: st,
																visitType: vt,
																gender: g,
															})}
														>
															{(r.cells[k] ?? 0).toLocaleString()}
														</td>
													);
												})}
											</tr>
										))
									)}
								</tbody>
								{pivot.rows.length > 0 && (
									<tfoot>
										<tr className="border-t bg-gray-50">
											<td className="px-3 py-2 font-semibold">Over all Cases</td>
											<td className="px-3 py-2" />
											<td className="px-3 py-2 text-right font-semibold">{pivot.totalLocal.toLocaleString()}</td>
											<td className="px-3 py-2 text-right font-semibold">{pivot.totalOuter.toLocaleString()}</td>
											<td className="px-3 py-2 text-right font-semibold">{pivot.grandTotal.toLocaleString()}</td>
											{pivotKeysDetailed.map(k => (
												<td key={k} className="px-3 py-2 text-center font-semibold">
													{(pivot.columnTotals[k] ?? 0).toLocaleString()}
												</td>
											))}
										</tr>
									</tfoot>
								)}
							</table>
						</div>
					</div>
				)}
			</div>

			{/* ---------- DETAIL MODAL ---------- */}
			{detailOpen && (
				<div className="fixed inset-0 z-50">
					<div className="absolute inset-0 bg-black/40" onClick={() => setDetailOpen(false)} />
					<div className="absolute inset-0 flex items-center justify-center p-4">
						<div className="w-full max-w-6xl rounded-2xl bg-white shadow-xl border">
							<div className="flex items-center justify-between px-4 py-3 border-b">
								<div className="font-semibold">Appointments — {detailTitle}</div>
								<div className="flex items-center gap-2">
									<button className="text-sm border rounded px-2 py-1" onClick={downloadCSV} title="Download CSV">
										Download CSV
									</button>
									<button onClick={() => setDetailOpen(false)} className="p-1 rounded hover:bg-gray-100" aria-label="Close">
										<X className="h-5 w-5" />
									</button>
								</div>
							</div>

							<div className="px-4 py-3">
								{detailErr && <div className="mb-2 text-sm text-red-600">{detailErr}</div>}
								{detailLoading ? (
									<div className="text-sm text-gray-600">Loading…</div>
								) : detailRows.length === 0 ? (
									<div className="text-sm text-gray-500">No appointments found for this slice.</div>
								) : (
									<div className="overflow-x-auto max-h-[60vh] border rounded">
										<table className="min-w-[1200px] text-sm">
											<thead className="bg-gray-50 sticky top-0 z-10">
												<tr>
													<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700 w-16">S.No</th>
													<SortHdr k="apptAt">App. Date</SortHdr>
													<SortHdr k="tpaName">TPA Name</SortHdr>
													<SortHdr k="labName">Lab Name</SortHdr>
													<SortHdr k="insuranceNickName">Insurance Nick name</SortHdr>
													<SortHdr k="clientName">Client Name</SortHdr>
													<SortHdr k="status">Status</SortHdr>
													<SortHdr k="visitType">Visit Type</SortHdr>
													<SortHdr k="serviceType">Service Type</SortHdr>
													<SortHdr k="extraChargeRs">Extra Amount</SortHdr>
												</tr>
											</thead>
											<tbody>
												{sortedDetailRows.map((r, i) => (
													<tr key={r.id} className="border-t">
														<td className="px-3 py-2">{i + 1}</td>
														<td className="px-3 py-2 whitespace-nowrap">{new Date(r.apptAt).toLocaleDateString()}</td>
														<td className="px-3 py-2">{r.tpaName ?? ''}</td>
														<td className="px-3 py-2">{r.labName ?? ''}</td>
														<td className="px-3 py-2">{r.insuranceNickName ?? ''}</td>
														<td className="px-3 py-2">{r.clientName ?? ''}</td>
														<td className="px-3 py-2">{r.status ?? ''}</td>
														<td className="px-3 py-2">{r.visitType === 'HOME' ? 'Home' : r.visitType === 'CENTER' ? 'Center' : (r.visitType ?? '')}</td>
														<td className="px-3 py-2">{r.serviceType ?? ''}</td>
														<td className="px-3 py-2 text-right">{r.extraChargeRs != null ? `₹${Number(r.extraChargeRs).toLocaleString()}` : ''}</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								)}
							</div>

							<div className="px-4 py-3 border-t flex justify-end">
								<button className="rounded bg-brand text-white px-4 py-2" onClick={() => setDetailOpen(false)}>Close</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
