'use client';

import { useEffect, useMemo, useState } from 'react';
import {
	CalendarDays, Clock, FileWarning, GaugeCircle, CheckCircle2, TrendingUp, Building2, X
} from 'lucide-react';
import {
	Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend
} from 'recharts';

type LabLite = { id: string; name: string };

type ChartsPayload = {
	appointments: Array<{ date: string; TBI: number; OnHold: number; MedicalDone: number; Cancelled: number }>;
	inprogress: Array<{ date: string; Waiting: number; NotResponding: number; Rescheduled: number; NeedConfirmation: number }>;
	reports: Array<{ date: string; OnProcess: number; Completed: number; Submitted: number }>;
};

type TotalsPayload = {
	todays: number;
	upcoming: number;
	uploadPending: number;
	outOfTat: number;
	totalInRange: string;
	closed: number;
};

type MetricsPayload = {
	totals: TotalsPayload;
	charts: ChartsPayload;
};

const DEFAULT_CHARTS: ChartsPayload = { appointments: [], inprogress: [], reports: [] };
const DEFAULT_TOTALS: TotalsPayload = { todays: 0, upcoming: 0, uploadPending: 0, outOfTat: 0, totalInRange: '0 / 0', closed: 0 };
const DEFAULT_METRICS: MetricsPayload = { totals: DEFAULT_TOTALS, charts: DEFAULT_CHARTS };

function normalizeMetrics(x: any): MetricsPayload {
	const charts = x?.charts ?? {};
	const totals = x?.totals ?? {};
	return {
		totals: {
			todays: Number(totals.todays ?? 0),
			upcoming: Number(totals.upcoming ?? 0),
			uploadPending: Number(totals.uploadPending ?? 0),
			outOfTat: Number(totals.outOfTat ?? 0),
			totalInRange: typeof totals.totalInRange === 'string' ? totals.totalInRange : '0 / 0',
			closed: Number(totals.closed ?? 0),
		},
		charts: {
			appointments: Array.isArray(charts.appointments) ? charts.appointments : [],
			inprogress: Array.isArray(charts.inprogress) ? charts.inprogress : [],
			reports: Array.isArray(charts.reports) ? charts.reports : [],
		},
	};
}

function toYmd(d: Date) {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function isoToDateOnly(iso: string) {
	const d = new Date(iso);
	if (!Number.isNaN(d.getTime())) return toYmd(d);
	return '';
}

function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function endOfToday() { const d = new Date(); d.setHours(23, 59, 59, 999); return d; }
function startOfWeekMonday(d = new Date()) { const x = new Date(d); const dow = (x.getDay() + 6) % 7; x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - dow); return x; }
function endOfWeekFromStart(s: Date) { const e = new Date(s); e.setDate(s.getDate() + 6); e.setHours(23, 59, 59, 999); return e; }

type PresetKey = 'today' | 'yesterday' | 'prev-week' | 'prev-7' | 'prev-30' | 'prev-month' | 'prev-3m' | 'prev-12m';

// ---------- Modal table helpers ----------
type DetailRow = {
	id: string;
	apptAt: string;
	labName: string;
	tpaName: string;
	insuranceName: string;
	clientName: string;
	clientRef: string;
	status: string;
};

type DetailKind = 'today' | 'upcoming' | 'uploadPending';

export default function FilterDashboardClient({
	role, labs, initialLabId, initialFrom, initialTo, initialMetrics,
}: {
	role: string;
	labs: LabLite[];
	initialLabId: string | null;
	initialFrom: string;
	initialTo: string;
	initialMetrics: MetricsPayload | any;
}) {
	const [labId, setLabId] = useState<string>(initialLabId ?? '');
	const [from, setFrom] = useState<string>(isoToDateOnly(initialFrom));
	const [to, setTo] = useState<string>(isoToDateOnly(initialTo));

	const [loading, setLoading] = useState(false);
	const [metrics, setMetrics] = useState<MetricsPayload>(normalizeMetrics(initialMetrics));
	const [err, setErr] = useState<string | null>(null);
	const [preset, setPreset] = useState<PresetKey | ''>('');

	// Modal state
	const [modalOpen, setModalOpen] = useState(false);
	const [modalTitle, setModalTitle] = useState('');
	const [detailKind, setDetailKind] = useState<DetailKind>('today');
	const [detailLoading, setDetailLoading] = useState(false);
	const [detailErr, setDetailErr] = useState<string | null>(null);
	const [rows, setRows] = useState<DetailRow[]>([]);
	// table controls
	const [q, setQ] = useState('');
	const [sortKey, setSortKey] = useState<keyof DetailRow>('apptAt');
	const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
	const [page, setPage] = useState(1);
	const pageSize = 12;

	async function load() {
		setLoading(true); setErr(null);
		try {
			const body = { labId: labId || null, from, to };
			const res = await fetch('/api/dashboard/metrics', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
			const raw = await res.json();
			if (!res.ok) throw new Error(raw?.error || 'Failed to load metrics');
			setMetrics(normalizeMetrics(raw));
		} catch (e: any) {
			setErr(e?.message || 'Network error');
			setMetrics(m => normalizeMetrics(m ?? DEFAULT_METRICS));
		} finally {
			setLoading(false);
		}
	}
	useEffect(() => { load(); /* eslint-disable-next-line */ }, [labId, from, to]);

	function applyPreset(p: PresetKey) {
		const now = new Date();
		let f: Date, t: Date;
		switch (p) {
			case 'today': { f = startOfToday(); t = endOfToday(); break; }
			case 'yesterday': { f = startOfToday(); f.setDate(f.getDate() - 1); t = endOfToday(); t.setDate(t.getDate() - 1); break; }
			case 'prev-week': {
				const cur = startOfWeekMonday(now);
				f = new Date(cur); f.setDate(cur.getDate() - 7);
				t = endOfWeekFromStart(f);
				break;
			}
			case 'prev-7': { t = endOfToday(); f = new Date(t); f.setDate(t.getDate() - 6); f.setHours(0, 0, 0, 0); break; }
			case 'prev-30': { t = endOfToday(); f = new Date(t); f.setDate(t.getDate() - 29); f.setHours(0, 0, 0, 0); break; }
			case 'prev-month': {
				const y = now.getFullYear(), m = now.getMonth();
				f = new Date(y, m - 1, 1, 0, 0, 0, 0);
				t = new Date(y, m, 0, 23, 59, 59, 999);
				break;
			}
			case 'prev-3m': {
				const y = now.getFullYear(), m = now.getMonth();
				f = new Date(y, m - 3, 1, 0, 0, 0, 0);
				t = new Date(y, m, 0, 23, 59, 59, 999);
				break;
			}
			case 'prev-12m': {
				const y = now.getFullYear(), m = now.getMonth();
				f = new Date(y, m - 12, 1, 0, 0, 0, 0);
				t = new Date(y, m, 0, 23, 59, 59, 999);
				break;
			}
		}
		setPreset(p);
		setFrom(toYmd(f));
		setTo(toYmd(t));
	}

	// ----- details loader -----
	async function openDetails(kind: DetailKind, title: string) {
		setModalTitle(title);
		setDetailKind(kind);
		setModalOpen(true);
		setDetailErr(null);
		setDetailLoading(true);
		setQ(''); setPage(1); setSortKey('apptAt'); setSortDir('desc');

		try {
			const res = await fetch('/api/dashboard/details', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ kind, labId: labId || null, from, to }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data?.error || 'Failed to load details');
			setRows(Array.isArray(data?.items) ? data.items : []);
		} catch (e: any) {
			setDetailErr(e?.message || 'Network error');
			setRows([]);
		} finally {
			setDetailLoading(false);
		}
	}

	// table filtering + sorting + paging
	const visible = useMemo(() => {
		const term = q.trim().toLowerCase();
		const base = term
			? rows.filter(r =>
				[r.apptAt, r.labName, r.tpaName, r.insuranceName, r.clientName, r.clientRef]
					.some(v => String(v || '').toLowerCase().includes(term)))
			: rows;

		const sorted = [...base].sort((a, b) => {
			const va = a[sortKey] ?? ''; const vb = b[sortKey] ?? '';
			const cmp = (va > vb) ? 1 : (va < vb) ? -1 : 0;
			return sortDir === 'asc' ? cmp : -cmp;
		});

		const start = (page - 1) * pageSize;
		return { rows: sorted.slice(start, start + pageSize), total: sorted.length };
	}, [rows, q, sortKey, sortDir, page]);

	const safeTotals = metrics?.totals ?? DEFAULT_TOTALS;
	const safeCharts = metrics?.charts ?? DEFAULT_CHARTS;

	return (
		<div className="space-y-4">
			{/* Edge-to-edge menu bar */}
			<div className="-mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
				<div className="rounded-none border-x-0 border-t border-b bg-blue-200 p-4 shadow-sm w-full">
					<div className="flex flex-wrap items-end gap-3">
						{/* Lab picker */}
						<div className="flex flex-col">
							<label className="text-xs text-gray-900 mb-1">Lab</label>
							<div className="inline-flex items-center gap-2">
								<Building2 className="h-4 w-4 text-gray-900" />
								<select
									className="border rounded px-3 py-2 min-w-[270px]"
									value={labId}
									onChange={(e) => setLabId(e.target.value)}
								>
									<option value="">All Labs</option>
									{labs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
								</select>
							</div>
						</div>

						{/* Date range manual inputs */}
						<div className="flex gap-2 items-end">
							<div>
								<label className="text-xs text-gray-900 mb-1">From &nbsp;&nbsp;</label>
								<input type="date" className="border rounded px-3 py-2" value={from} onChange={(e) => { setPreset(''); setFrom(e.target.value); }} />
							</div>
							<div>
								<label className="text-xs text-gray-900 mb-1">To&nbsp;&nbsp;</label>
								<input type="date" className="border rounded px-3 py-2" value={to} onChange={(e) => { setPreset(''); setTo(e.target.value); }} />
							</div>
						</div>

						{/* Preset dropdown */}
						<div className="flex flex-col">
							<label className="text-xs text-gray-900 mb-1">Quick range</label>
							<select
								className="border rounded px-3 py-2 min-w-[220px]"
								value={preset}
								onChange={(e) => applyPreset(e.target.value as PresetKey)}
							>
								<option value="" disabled>Select…</option>
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
							onClick={load}
							className="ml-auto bg-brand text-white rounded px-3 py-2 text-sm"
							disabled={loading}
							title="Apply filters"
						>
							{loading ? 'Loading…' : 'Apply'}
						</button>
					</div>

					{err && <div className="mt-3 text-sm text-red-600">{err}</div>}
				</div>
			</div>

			{/* Cards (clickable) */}
			<div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
				<Tile
					title="Today's Appointments"
					value={safeTotals.todays}
					icon={<CalendarDays className="h-5 w-5" />}
					tone="indigo"
					onClick={() => openDetails('today', 'Today’s Appointments')}
				/>
				<Tile
					title="Upcoming Appointments"
					value={safeTotals.upcoming}
					icon={<Clock className="h-5 w-5" />}
					tone="sky"
					onClick={() => openDetails('upcoming', 'Upcoming Appointments')}
				/>
				<Tile
					title="Report Upload Pending"
					value={safeTotals.uploadPending}
					icon={<FileWarning className="h-5 w-5" />}
					tone="amber"
					onClick={() => openDetails('uploadPending', 'Report Upload Pending')}
				/>
				<Tile
					title="Out Of TAT"
					value={safeTotals.outOfTat}
					icon={<GaugeCircle className="h-5 w-5" />}
					tone="rose"
				/>
				<Tile
					title="Total (in range)"
					value={safeTotals.totalInRange}
					icon={<TrendingUp className="h-5 w-5" />}
					tone="emerald"
				/>
				<Tile
					title="Closed Appointments"
					value={safeTotals.closed}
					icon={<CheckCircle2 className="h-5 w-5" />}
					tone="teal"
				/>
			</div>


			{/* Charts */}
			<div className="grid grid-cols-1 gap-4">
				<ChartCard title="Appointment Trend (TBI / On hold / Medical Done / Cancelled)">
					<AreaStack data={safeCharts.appointments} lines={[
						{ key: 'TBI', label: 'TBI', color: '#6366F1' },
						{ key: 'OnHold', label: 'On hold', color: '#F59E0B' },
						{ key: 'MedicalDone', label: 'Medical Done', color: '#10B981' },
						{ key: 'Cancelled', label: 'Cancelled', color: '#EF4444' },
					]} />
				</ChartCard>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<ChartCard title="Appointment In-Progress Trend (Waiting / Not Responding / Rescheduled / Need Confirmation)">
					<AreaStack data={safeCharts.inprogress} lines={[
						{ key: 'Waiting', label: 'Waiting for response', color: '#22C55E' },
						{ key: 'NotResponding', label: 'Not Responding', color: '#A855F7' },
						{ key: 'Rescheduled', label: 'Rescheduled', color: '#3B82F6' },
						{ key: 'NeedConfirmation', label: 'Need Confirmation', color: '#F97316' },
					]} />
				</ChartCard>
				<ChartCard title="Report Trend (OnProcess / Completed / Submitted)">
					<AreaStack data={safeCharts.reports} lines={[
						{ key: 'OnProcess', label: 'OnProcess', color: '#0EA5E9' },
						{ key: 'Completed', label: 'Completed', color: '#84CC16' },
						{ key: 'Submitted', label: 'Submitted', color: '#0051ffff' },
					]} />
				</ChartCard>
			</div>

			{/* Modal */}
			{modalOpen && (
				<div className="fixed inset-0 z-50 flex items-start md:items-center justify-center bg-black/40 p-3">
					<div className="bg-white rounded-xl shadow-lg w-full max-w-6xl">
						<div className="flex items-center justify-between p-3 border-b bg-blue-300">
							<h3 className="font-semibold">{modalTitle}</h3>
							<button className="p-1 rounded hover:bg-gray-100" onClick={() => setModalOpen(false)}><X className="h-5 w-5" /></button>
						</div>

						<div className="p-3">
							{/* controls */}
							<div className="flex items-center gap-3 mb-3">
								<input
									placeholder="Search…"
									className="border rounded px-3 py-2 w-72"
									value={q}
									onChange={(e) => { setQ(e.target.value); setPage(1); }}
								/>
								<div className="ml-auto text-sm text-gray-600">
									{detailLoading ? 'Loading…' : `${visible.total} result(s)`}
								</div>
							</div>

							<div className="overflow-x-auto border rounded">
								<table className="min-w-full text-sm">
									<thead className="bg-gray-50">
										<tr>
											{([
												['apptAt', 'Appointment Date'],
												['labName', 'Lab Name'],
												['status', 'Status'],
												['tpaName', 'TPA Name'],
												['insuranceName', 'Insurance'],
												['clientName', 'Client Name'],
												['clientRef', 'Ref'],
											] as Array<[keyof DetailRow, string]>).map(([k, label]) => (
												<th key={k} className="px-3 py-2 text-left font-semibold cursor-pointer select-none"
													onClick={() => { setSortKey(k); setSortDir(d => (k === sortKey ? (d === 'asc' ? 'desc' : 'asc') : 'asc')); }}>
													<span className="inline-flex items-center gap-1">
														{label}{sortKey === k ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
													</span>
												</th>
											))}
										</tr>
									</thead>
									<tbody>
										{detailLoading ? (
											<tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">Loading…</td></tr>
										) : visible.rows.length === 0 ? (
											<tr><td colSpan={6} className="px-3 py-6 text-center text-gray-500">No data</td></tr>
										) : (
											visible.rows.map(r => (
												<tr key={r.id} className="border-t hover:bg-gray-50">
													<td className="px-3 py-2 whitespace-nowrap">{r.apptAt}</td>
													<td className="px-3 py-2">{r.labName}</td>
													<td className="px-3 py-2 text-sm">
														<span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
															{r.status || '—'}
														</span>
													</td>
													<td className="px-3 py-2">{r.tpaName}</td>
													<td className="px-3 py-2">{r.insuranceName}</td>
													<td className="px-3 py-2">{r.clientName}</td>
													<td className="px-3 py-2">{r.clientRef}</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>

							{/* pagination */}
							<div className="flex items-center justify-between mt-3">
								<div className="text-xs text-gray-500">
									Page {page} / {Math.max(1, Math.ceil(visible.total / pageSize))}
								</div>
								<div className="flex items-center gap-2">
									<button className="border rounded px-2 py-1 text-sm disabled:opacity-40"
										disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
									<button className="border rounded px-2 py-1 text-sm disabled:opacity-40"
										disabled={page >= Math.ceil(visible.total / pageSize)}
										onClick={() => setPage(p => p + 1)}>Next</button>
								</div>
							</div>
						</div>

						<div className="p-3 border-t text-right">
							<button className="rounded border px-3 py-1.5" onClick={() => setModalOpen(false)}>Close</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function Tile({
	title,
	value,
	icon,
	tone = 'indigo',
	onClick,
}: {
	title: string;
	value: number | string;
	icon: React.ReactNode;
	tone?:
	| 'indigo'
	| 'sky'
	| 'amber'
	| 'rose'
	| 'emerald'
	| 'teal'
	| 'violet'
	| 'cyan'
	| 'lime';
	onClick?: () => void;
}) {
	const styles: Record<
		string,
		{
			gradient: string;
			border: string;
			chipBg: string;
			chipText: string;
			shadow: string;
			hover: string;
		}
	> = {
		indigo: {
			gradient:
				'bg-gradient-to-br from-indigo-200 via-indigo-100 to-white',
			border: 'border-indigo-500',
			chipBg: 'bg-indigo-100',
			chipText: 'text-indigo-700',
			shadow: 'shadow-indigo-100',
			hover: 'hover:from-indigo-300 hover:via-indigo-100',
		},
		sky: {
			gradient: 'bg-gradient-to-br from-sky-200 via-sky-100 to-white',
			border: 'border-sky-500',
			chipBg: 'bg-sky-150',
			chipText: 'text-sky-700',
			shadow: 'shadow-sky-100',
			hover: 'hover:from-sky-300 hover:via-sky-100',
		},
		amber: {
			gradient: 'bg-gradient-to-br from-amber-200 via-amber-100 to-white',
			border: 'border-amber-500',
			chipBg: 'bg-amber-50',
			chipText: 'text-amber-700',
			shadow: 'shadow-amber-100',
			hover: 'hover:from-amber-300 hover:via-amber-100',
		},
		rose: {
			gradient: 'bg-gradient-to-br from-rose-200 via-rose-100 to-white',
			border: 'border-rose-500',
			chipBg: 'bg-rose-50',
			chipText: 'text-rose-700',
			shadow: 'shadow-rose-100',
			hover: 'hover:from-rose-300 hover:via-rose-100',
		},
		emerald: {
			gradient:
				'bg-gradient-to-br from-emerald-200 via-emerald-100 to-white',
			border: 'border-emerald-500',
			chipBg: 'bg-emerald-50',
			chipText: 'text-emerald-700',
			shadow: 'shadow-emerald-100',
			hover: 'hover:from-emerald-300 hover:via-emerald-100',
		},
		teal: {
			gradient: 'bg-gradient-to-br from-teal-200 via-teal-100 to-white',
			border: 'border-teal-500',
			chipBg: 'bg-teal-50',
			chipText: 'text-teal-700',
			shadow: 'shadow-teal-100',
			hover: 'hover:from-teal-300 hover:via-teal-100',
		},
		violet: {
			gradient:
				'bg-gradient-to-br from-violet-200 via-violet-100 to-white',
			border: 'border-violet-500',
			chipBg: 'bg-violet-50',
			chipText: 'text-violet-700',
			shadow: 'shadow-violet-100',
			hover: 'hover:from-violet-300 hover:via-violet-100',
		},
		cyan: {
			gradient: 'bg-gradient-to-br from-cyan-200 via-cyan-100 to-white',
			border: 'border-cyan-500',
			chipBg: 'bg-cyan-50',
			chipText: 'text-cyan-700',
			shadow: 'shadow-cyan-100',
			hover: 'hover:from-cyan-300 hover:via-cyan-100',
		},
		lime: {
			gradient: 'bg-gradient-to-br from-lime-200 via-lime-100 to-white',
			border: 'border-lime-500',
			chipBg: 'bg-lime-50',
			chipText: 'text-lime-700',
			shadow: 'shadow-lime-100',
			hover: 'hover:from-lime-300 hover:via-lime-100',
		},
	};

	const s = styles[tone];

	return (
		<button
			type="button"
			onClick={onClick}
			className={[
				'text-left rounded-xl p-4 transition',
				'border', s.border, s.gradient, s.shadow, s.hover,
				'hover:shadow-md'
			].join(' ')}
			title={onClick ? 'Open details' : undefined}
		>
			<div className="flex items-center gap-3">
				<div className={['inline-flex h-9 w-9 items-center justify-center rounded-lg border', s.chipBg, s.chipText].join(' ')}>
					{icon}
				</div>
				<div className="text-sm text-gray-700 font-medium">{title}</div>
			</div>
			<div className="text-2xl font-semibold mt-2">{value}</div>
		</button>
	);
}


function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="rounded-xl border bg-white p-4 shadow-sm">
			<h3 className="text-base font-semibold mb-3">{title}</h3>
			<div className="h-72">{children}</div>
		</div>
	);
}

function AreaStack({
	data, lines,
}: { data: Array<Record<string, any>>; lines: Array<{ key: string; label: string; color: string }> }) {
	const safeData = Array.isArray(data) ? data : [];
	return (
		<ResponsiveContainer width="100%" height="100%">
			<AreaChart data={safeData}>
				<CartesianGrid strokeDasharray="3 3" />
				<XAxis dataKey="date" />
				<YAxis allowDecimals={false} />
				<Tooltip />
				<Legend />
				{lines.map(({ key, label, color }) => (
					<Area key={key} type="monotone" dataKey={key} name={label} stroke={color} fill={color} fillOpacity={0.15} />
				))}
			</AreaChart>
		</ResponsiveContainer>
	);
}
