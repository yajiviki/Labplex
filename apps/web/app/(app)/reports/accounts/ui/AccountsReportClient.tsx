'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, Workflow, CalendarRange, Undo2 } from 'lucide-react';
import {
	Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend
} from 'recharts';

type LabLite = { id: string; name: string };
type VendorLite = { id: string; tpaName: string };

type TableRow = { labId: string | null; labName: string; vendorId: string | null; tpaName: string; totalExtra: number };
type TrendRow = { date: string; amount: number };

type PresetKey =
	| 'today'
	| 'yesterday'
	| 'prev-week'
	| 'prev-7'
	| 'prev-30'
	| 'prev-month'
	| 'prev-3m'
	| 'prev-12m';

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
	initialData: { table: TableRow[]; trend: TrendRow[] };
}) {
	// Toolbar filters (these define the "filtered trend")
	const [labId, setLabId] = useState<string>(initialLabId ?? '');
	const [vendorId, setVendorId] = useState<string>(initialVendorId ?? '');
	const [from, setFrom] = useState<string>(initialFrom);
	const [to, setTo] = useState<string>(initialTo);
	const [preset, setPreset] = useState<PresetKey | ''>('');

	// Focused pair (when user clicks a table row). If null, we show the filtered trend.
	const [focused, setFocused] = useState<{ labId: string | null; vendorId: string | null } | null>(null);

	const [loading, setLoading] = useState(false);
	const [err, setErr] = useState<string | null>(null);

	const [table, setTable] = useState<TableRow[]>(Array.isArray(initialData?.table) ? initialData.table : []);
	const [trend, setTrend] = useState<TrendRow[]>(Array.isArray(initialData?.trend) ? initialData.trend : []);

	// Title reflects current view (filtered vs focused)
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
			case 'prev-month': { const y = now.getFullYear(), m = now.getMonth(); f = new Date(y, m - 1, 1, 0, 0, 0, 0); t = new Date(y, m, 0, 23, 59, 59, 999); break; }
			case 'prev-3m': { const y = now.getFullYear(), m = now.getMonth(); f = new Date(y, m - 3, 1, 0, 0, 0, 0); t = new Date(y, m, 0, 23, 59, 59, 999); break; }
			case 'prev-12m': { const y = now.getFullYear(), m = now.getMonth(); f = new Date(y, m - 12, 1, 0, 0, 0, 0); t = new Date(y, m, 0, 23, 59, 59, 999); break; }
		}
		setPreset(p);
		setFrom(toYmd(f));
		setTo(toYmd(t));
	}

	// Core loader. If `focused` is set, use that pair; otherwise use toolbar filters.
	async function load() {
		setLoading(true); setErr(null);
		try {
			const effLabId = focused ? (focused.labId || null) : (labId || null);
			const effVenId = focused ? (focused.vendorId || null) : (vendorId || null);

			const res = await fetch('/api/reports/accounts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ labId: effLabId, vendorId: effVenId, from, to }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data?.error || 'Failed to load');

			setTable(Array.isArray(data.table) ? data.table : []);
			setTrend(Array.isArray(data.trend) ? data.trend : []);
		} catch (e: any) {
			setErr(e?.message || 'Network error');
			setTable([]); setTrend([]);
		} finally {
			setLoading(false);
		}
	}

	// When filters, dates, or focus changes → reload.
	useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [labId, vendorId, from, to, focused]);

	// Click a summary row → focus the chart to that Lab/TPA (without changing toolbar picks)
	function focusRow(r: TableRow) {
		setFocused({ labId: r.labId ?? null, vendorId: r.vendorId ?? null });
	}
	// Leave focused mode → revert to current toolbar selection
	function clearFocus() {
		setFocused(null);
	}

	const totalSum = useMemo(() => table.reduce((s, r) => s + (r.totalExtra || 0), 0), [table]);

	return (
		<div className="space-y-4">
			{/* Header */}
			<div className="rounded-xl border bg-white p-4 shadow-sm">
				<h1 className="text-xl font-semibold">Reports → Accounts</h1>
				<p className="text-sm text-gray-600 mt-1">Extra amount (Rs) summary &amp; daily trend.</p>
			</div>

			{/* Sticky, edge-to-edge toolbar with Quick range */}
			<div className="-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/60 bg-white/90">
				<div className="rounded-none border-x-0 border-t border-b bg-white p-4 shadow-sm w-full">
					<div className="flex flex-wrap items-end gap-3">
						{/* Lab */}
						<div className="flex flex-col">
							<label className="text-xs text-gray-600 mb-1">Lab</label>
							<div className="inline-flex items-center gap-2">
								<Building2 className="h-4 w-4 text-gray-500" />
								<select
									className="border rounded px-3 py-2 min-w-[220px]"
									value={labId}
									onChange={(e) => setLabId(e.target.value)}
								>
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
								<select
									className="border rounded px-3 py-2 min-w-[220px]"
									value={vendorId}
									onChange={(e) => setVendorId(e.target.value)}
								>
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
								<input
									type="date"
									className="border rounded px-3 py-2"
									value={from}
									onChange={(e) => { setPreset(''); setFrom(e.target.value); }}
								/>
							</div>
						</div>
						<div className="flex flex-col">
							<label className="text-xs text-gray-600 mb-1">To</label>
							<input
								type="date"
								className="border rounded px-3 py-2"
								value={to}
								onChange={(e) => { setPreset(''); setTo(e.target.value); }}
							/>
						</div>

						{/* Quick range (same as Dashboard) */}
						<div className="flex flex-col">
							<label className="text-xs text-gray-600 mb-1">Quick range</label>
							<select
								className="border rounded px-3 py-2 min-w-[220px]"
								value={preset}
								onChange={(e) => applyPreset(e.target.value as PresetKey)}
							>
								<option value="">Select…</option>
								<option value="today">Today</option>
								<option value="yesterday">Yesterday</option>
								<option value="prev-week">Previous week</option>
								<option value="prev-7">Previous 7 days</option>
								<option value="prev-30">Previous 30 days</option>
								<option value="prev-month">Previous month</option>
								<option value="prev-3m">Previous 3 months</option>
								<option value="prev-12m">Previous 12 months</option>
							</select>
						</div>

						<button
							type="button"
							onClick={() => load()}
							className="ml-auto bg-brand text-white rounded px-3 py-2 text-sm"
							disabled={loading}
						>
							{loading ? 'Loading…' : 'Apply'}
						</button>
					</div>

					{err && <div className="mt-3 text-sm text-red-600">{err}</div>}
				</div>
			</div>

			{/* Table + Chart side-by-side */}
			<div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
				{/* Summary + table (scrollable) */}
				<div className="rounded-xl border bg-white p-4 shadow-sm lg:col-span-1">
					<div className="flex items-center justify-between mb-3">
						<h3 className="font-semibold">Extra Amount Summary</h3>
						<div className="text-sm text-gray-600">
							Total: <span className="font-semibold">₹{useMemo(() => table.reduce((s, r) => s + (r.totalExtra || 0), 0), [table]).toLocaleString()}</span>
						</div>
					</div>

					<div className="overflow-x-auto">
						{/* Fixed height + vertical scroll; sticky header */}
						<div className="border rounded max-h-80 overflow-y-auto">
							<table className="min-w-full text-sm">
								<thead className="bg-gray-50 sticky top-0 z-10">
									<tr>
										<th className="px-3 py-2 text-left font-semibold">Lab</th>
										<th className="px-3 py-2 text-left font-semibold">TPA</th>
										<th className="px-3 py-2 text-right font-semibold">Total Extra (Rs)</th>
									</tr>
								</thead>
								<tbody>
									{loading ? (
										<tr><td className="px-3 py-4 text-center" colSpan={3}>Loading…</td></tr>
									) : table.length === 0 ? (
										<tr><td className="px-3 py-4 text-center text-gray-500" colSpan={3}>No data</td></tr>
									) : (
										table.map((r, idx) => (
											<tr
												key={`${r.labId ?? 'all'}-${r.vendorId ?? 'all'}-${idx}`}
												className="border-t hover:bg-gray-50 cursor-pointer"
												onClick={() => focusRow(r)}
												title="Click to show trend for this Lab & TPA"
											>
												<td className="px-3 py-2">{r.labName}</td>
												<td className="px-3 py-2">{r.tpaName}</td>
												<td className="px-3 py-2 text-right">₹{(r.totalExtra ?? 0).toLocaleString()}</td>
											</tr>
										))
									)}
								</tbody>
							</table>
						</div>
					</div>
				</div>

				{/* Trend Chart */}
				<div className="rounded-xl border bg-white p-4 shadow-sm lg:col-span-2">
					<div className="flex items-center justify-between mb-3">
						<h3 className="text-base font-semibold">{chartTitle}</h3>
						{focused && (
							<button
								type="button"
								onClick={clearFocus}
								className="inline-flex items-center gap-1.5 text-sm px-2.5 py-1.5 border rounded hover:bg-gray-50"
								title="Back to filtered trend"
							>
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
								<Area type="monotone" dataKey="amount" name="Amount (Rs)" stroke="#0EA5E9" fill="#0EA5E9" fillOpacity={0.2} />
							</AreaChart>
						</ResponsiveContainer>
					</div>
				</div>
			</div>
		</div>
	);
}
