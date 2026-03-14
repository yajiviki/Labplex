'use client';

import { useEffect, useMemo, useState } from 'react';
import {
	Wallet,
	RefreshCcw,
	Save,
	AlertTriangle,
	ChevronDown,
	ChevronUp,
	IndianRupee,
	TrendingDown,
	Scale,
	TrendingUp,
	ReceiptText,
	BarChart3,
	CalendarDays,
} from 'lucide-react';
import {
	ResponsiveContainer,
	BarChart,
	Bar,
	CartesianGrid,
	XAxis,
	YAxis,
	Tooltip,
} from 'recharts';

type Lab = {
	id: string;
	name: string;
	nickName?: string | null;
	labCode?: string | null;
};

type Vendor = {
	id: string;
	vendorId?: string | null;
	tpaName?: string | null;
	nickName?: string | null;
};

type StaffOption = {
	id: string;
	name: string;
	userId?: string | null;
};

type SettlementRow = {
	id: string;
	appointmentId: string;
	staffId: string;
	staffName?: string;
	staffUserId?: string;
	patientName: string;
	vendorId: string;
	vendorName?: string;
	labId: string;
	labName?: string;
	appointmentDate: string | null;
	visitType?: string | null;
	location?: string | null;
	status?: string | null;
	travelCost: number;
	accommodationCost: number;
	totalSpent: number;
	tpaForecastAmount: number;
	profitLossAmount: number;
	profitLossStatus: string;
	remarks: string;
	createdAt?: string | null;
	updatedAt?: string | null;
};

type SettlementSummary = {
	totalTransactions: number;
	pettyCashBalance?: number;
	totalSpent: number;
	totalForecast: number;
	netProfitLoss: number;
};

type PettyCashDashboardResp = {
	success: boolean;
	kpis: {
		totalReceived: number;
		totalRepaid: number;
		pendingBalance: number;
		activeAccounts: number;
	};
};

function formatDateOnly(iso?: string | null) {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatTime(iso?: string | null) {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ymdToday() {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function ymToday() {
	return ymdToday().slice(0, 7);
}

function normalizeVisitType(v?: string | null) {
	const s = (v || '').toUpperCase().trim();
	if (s === 'CENTER') return 'CENTER';
	if (s === 'HOME') return 'HOME';
	return '';
}

function vendorLabel(v: Vendor) {
	const name = v.nickName || v.tpaName || 'TPA';
	const code = v.vendorId ? ` (${v.vendorId})` : '';
	return `${name}${code}`;
}

function staffLabel(s?: { name?: string | null; userId?: string | null }) {
	if (!s?.name) return 'Unassigned';
	return s.userId ? `${s.name} (${s.userId})` : s.name;
}

function fmtINR(n: number) {
	return new Intl.NumberFormat('en-IN', {
		style: 'currency',
		currency: 'INR',
		maximumFractionDigits: 2,
		minimumFractionDigits: 2,
	}).format(Number.isFinite(n) ? n : 0);
}

function num(v: string | number | null | undefined) {
	const n = Number(v ?? 0);
	return Number.isFinite(n) ? n : 0;
}

function getMonthKeyFromIso(iso?: string | null) {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	return `${y}-${m}`;
}

function getDayKeyFromIso(iso?: string | null) {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export default function TravelSettlementPage() {
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);

	const [labs, setLabs] = useState<Lab[]>([]);
	const [vendors, setVendors] = useState<Vendor[]>([]);
	const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
	const [rows, setRows] = useState<SettlementRow[]>([]);

	const [err, setErr] = useState<string | null>(null);
	const [ok, setOk] = useState<string | null>(null);

	const [labId, setLabId] = useState<string>('');
	const [vendorId, setVendorId] = useState<string>('');
	const [staffId, setStaffId] = useState<string>('');
	const [visitType, setVisitType] = useState<string>('');
	const [dateFrom, setDateFrom] = useState<string>(() => ymdToday());
	const [dateTo, setDateTo] = useState<string>(() => ymdToday());
	const [chartMonth, setChartMonth] = useState<string>(() => ymToday());

	const [summary, setSummary] = useState<SettlementSummary>({
		totalTransactions: 0,
		totalSpent: 0,
		totalForecast: 0,
		netProfitLoss: 0,
	});

	const [pettyCashKpis, setPettyCashKpis] = useState({
		totalReceived: 0,
		totalRepaid: 0,
		pendingBalance: 0,
		activeAccounts: 0,
	});

	const [draftTravel, setDraftTravel] = useState<Record<string, string>>({});
	const [draftAccommodation, setDraftAccommodation] = useState<Record<string, string>>({});
	const [draftRemark, setDraftRemark] = useState<Record<string, string>>({});

	type SortKey =
		| 'appointmentDate'
		| 'patientName'
		| 'visitType'
		| 'location'
		| 'staff'
		| 'travelCost'
		| 'accommodationCost'
		| 'totalSpent'
		| 'tpaForecastAmount'
		| 'profitLossAmount'
		| 'profitLossStatus';

	const [sortKey, setSortKey] = useState<SortKey>('appointmentDate');
	const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

	function sortBy(k: SortKey) {
		if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
		else {
			setSortKey(k);
			setSortDir(k === 'patientName' || k === 'location' || k === 'staff' ? 'asc' : 'desc');
		}
	}

	async function loadLabs() {
		try {
			const res = await fetch('/api/labs', { cache: 'no-store' });
			const data = await res.json().catch(() => []);
			if (!res.ok) return;
			setLabs(Array.isArray(data) ? data : []);
		} catch {
			// ignore
		}
	}

	async function loadVendors() {
		try {
			const res = await fetch('/api/vendors', { cache: 'no-store' });
			const data = await res.json().catch(() => []);
			if (!res.ok) return;
			const list = Array.isArray(data) ? data : [];
			list.sort((a: Vendor, b: Vendor) => vendorLabel(a).localeCompare(vendorLabel(b)));
			setVendors(list);
		} catch {
			// ignore
		}
	}

	function buildQuery() {
		const sp = new URLSearchParams();
		if (labId) sp.set('labId', labId);
		if (vendorId) sp.set('vendorId', vendorId);
		if (staffId) sp.set('staffId', staffId);
		if (visitType) sp.set('visitType', visitType);
		if (dateFrom) sp.set('dateFrom', dateFrom);
		if (dateTo) sp.set('dateTo', dateTo);
		const qs = sp.toString();
		return qs ? `?${qs}` : '';
	}

	async function loadPageData() {
		setLoading(true);
		setErr(null);
		setOk(null);

		try {
			const q = buildQuery();

			const [settlementRes, pettyCashRes] = await Promise.all([
				fetch(`/api/travel-settlements${q}`, { cache: 'no-store' }),
				fetch('/api/petty-cash/dashboard?period=month', { cache: 'no-store' }),
			]);

			const settlementData = await settlementRes.json().catch(() => null);
			const pettyCashData = (await pettyCashRes.json().catch(() => null)) as PettyCashDashboardResp | null;

			if (!settlementRes.ok || !settlementData?.ok) {
				setErr(settlementData?.error || 'Load failed');
				setRows([]);
				setStaffOptions([]);
				return;
			}

			const apiRows = Array.isArray(settlementData.rows) ? settlementData.rows : [];
			const apiStaffOptions = Array.isArray(settlementData.staffOptions) ? settlementData.staffOptions : [];
			const apiSummary = settlementData.summary || {
				totalTransactions: 0,
				totalSpent: 0,
				totalForecast: 0,
				netProfitLoss: 0,
			};

			setRows(apiRows);
			setStaffOptions(apiStaffOptions);
			setSummary(apiSummary);

			if (pettyCashRes.ok && pettyCashData?.success && pettyCashData.kpis) {
				setPettyCashKpis({
					totalReceived: num(pettyCashData.kpis.totalReceived),
					totalRepaid: num(pettyCashData.kpis.totalRepaid),
					pendingBalance: num(pettyCashData.kpis.pendingBalance),
					activeAccounts: num(pettyCashData.kpis.activeAccounts),
				});
			} else {
				setPettyCashKpis({
					totalReceived: 0,
					totalRepaid: 0,
					pendingBalance: 0,
					activeAccounts: 0,
				});
			}

			const t: Record<string, string> = {};
			const a: Record<string, string> = {};
			const r: Record<string, string> = {};

			for (const row of apiRows) {
				t[row.appointmentId] = String(row.travelCost ?? 0);
				a[row.appointmentId] = String(row.accommodationCost ?? 0);
				r[row.appointmentId] = row.remarks ?? '';
			}

			setDraftTravel(t);
			setDraftAccommodation(a);
			setDraftRemark(r);
		} catch (e: any) {
			setErr(e?.message || 'Network error');
			setRows([]);
			setStaffOptions([]);
			setPettyCashKpis({
				totalReceived: 0,
				totalRepaid: 0,
				pendingBalance: 0,
				activeAccounts: 0,
			});
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		loadLabs();
		loadVendors();
		loadPageData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		loadPageData();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [labId, vendorId, staffId, visitType, dateFrom, dateTo]);

	function currentTravel(r: SettlementRow) {
		return num(draftTravel[r.appointmentId]);
	}

	function currentAccommodation(r: SettlementRow) {
		return num(draftAccommodation[r.appointmentId]);
	}

	function currentRemark(r: SettlementRow) {
		return draftRemark[r.appointmentId] ?? r.remarks ?? '';
	}

	function currentTotalSpent(r: SettlementRow) {
		return currentTravel(r) + currentAccommodation(r);
	}

	function currentProfitLoss(r: SettlementRow) {
		return num(r.tpaForecastAmount) - currentTotalSpent(r);
	}

	function currentProfitStatus(r: SettlementRow) {
		const pl = currentProfitLoss(r);
		if (pl > 0) return 'Profit';
		if (pl < 0) return 'Loss';
		return 'Break-even';
	}

	function isRowChanged(r: SettlementRow) {
		return (
			num(r.travelCost) !== currentTravel(r) ||
			num(r.accommodationCost) !== currentAccommodation(r) ||
			(r.remarks ?? '') !== currentRemark(r)
		);
	}

	const filteredSortedRows = useMemo(() => {
		function val(r: SettlementRow, k: SortKey) {
			switch (k) {
				case 'appointmentDate':
					return r.appointmentDate ? new Date(r.appointmentDate).getTime() : 0;
				case 'patientName':
					return (r.patientName || '').toLowerCase();
				case 'visitType':
					return normalizeVisitType(r.visitType || '');
				case 'location':
					return (r.location || '').toLowerCase();
				case 'staff':
					return staffLabel({ name: r.staffName, userId: r.staffUserId }).toLowerCase();
				case 'travelCost':
					return currentTravel(r);
				case 'accommodationCost':
					return currentAccommodation(r);
				case 'totalSpent':
					return currentTotalSpent(r);
				case 'tpaForecastAmount':
					return num(r.tpaForecastAmount);
				case 'profitLossAmount':
					return currentProfitLoss(r);
				case 'profitLossStatus':
					return currentProfitStatus(r).toLowerCase();
				default:
					return '';
			}
		}

		return [...rows].sort((a, b) => {
			const va = val(a, sortKey);
			const vb = val(b, sortKey);
			if (va === vb) return 0;
			const cmp = va > vb ? 1 : -1;
			return sortDir === 'asc' ? cmp : -cmp;
		});
	}, [rows, sortKey, sortDir, draftTravel, draftAccommodation, draftRemark]);

	const changedRows = useMemo(() => filteredSortedRows.filter((r) => isRowChanged(r)), [filteredSortedRows]);

	const displaySummary = useMemo(() => {
		const totalSpent = filteredSortedRows.reduce((sum, r) => sum + currentTotalSpent(r), 0);
		const totalForecast = filteredSortedRows.reduce((sum, r) => sum + num(r.tpaForecastAmount), 0);
		const netProfitLoss = totalForecast - totalSpent;
		const totalPettyCash = pettyCashKpis.pendingBalance;
		const pettyCashBalance = totalPettyCash - totalSpent;

		return {
			totalTransactions: filteredSortedRows.length,
			totalPettyCash,
			totalSpent,
			pettyCashBalance,
			totalForecast,
			netProfitLoss,
		};
	}, [filteredSortedRows, pettyCashKpis, draftTravel, draftAccommodation]);

	const chartRows = useMemo(() => {
		return filteredSortedRows.filter((r) => getMonthKeyFromIso(r.appointmentDate) === chartMonth);
	}, [filteredSortedRows, chartMonth]);

	const staffChartData = useMemo(() => {
		const map = new Map<string, number>();

		for (const row of chartRows) {
			const label = staffLabel({ name: row.staffName, userId: row.staffUserId });
			const spent = currentTotalSpent(row);
			map.set(label, (map.get(label) || 0) + spent);
		}

		return Array.from(map.entries())
			.map(([name, amount]) => ({ name, amount }))
			.sort((a, b) => b.amount - a.amount);
	}, [chartRows, draftTravel, draftAccommodation]);

	const dayChartData = useMemo(() => {
		const map = new Map<string, number>();

		for (const row of chartRows) {
			const dayKey = getDayKeyFromIso(row.appointmentDate);
			if (!dayKey) continue;
			const spent = currentTotalSpent(row);
			map.set(dayKey, (map.get(dayKey) || 0) + spent);
		}

		return Array.from(map.entries())
			.map(([day, amount]) => ({
				day,
				label: day.slice(8, 10),
				amount,
			}))
			.sort((a, b) => a.day.localeCompare(b.day));
	}, [chartRows, draftTravel, draftAccommodation]);

	async function saveAll() {
		setErr(null);
		setOk(null);

		const items = changedRows.map((r) => ({
			appointmentId: r.appointmentId,
			travelCost: currentTravel(r),
			accommodationCost: currentAccommodation(r),
			remarks: currentRemark(r),
		}));

		if (!items.length) {
			setErr('No modified rows found in the current filter.');
			return;
		}

		setSaving(true);
		try {
			const res = await fetch('/api/travel-settlements', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ items }),
			});

			const data = await res.json().catch(() => ({}));

			if (!res.ok || !data?.ok) {
				setErr(data?.error || 'Save failed');
				return;
			}

			setOk(`Transactions saved (${items.length})`);
			await loadPageData();
		} catch (e: any) {
			setErr(e?.message || 'Network error');
		} finally {
			setSaving(false);
		}
	}

	const SortTh = ({ k, label }: { k: SortKey; label: string }) => {
		const active = sortKey === k;
		return (
			<th
				className="px-3 py-2 text-left text-xs font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap"
				onClick={() => sortBy(k)}
				title={`Sort by ${label}`}
			>
				<span className="inline-flex items-center gap-1">
					{label}
					{active ? sortDir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" /> : null}
				</span>
			</th>
		);
	};

	return (
		<div className="mx-auto w-full max-w-[1800px] px-4 space-y-6">
			<div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm flex items-start justify-between gap-4">
				<div className="flex items-start gap-3">
					<div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
						<Wallet className="h-5 w-5" />
					</div>
					<div>
						<h1 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
							Travel Expense Settlement
						</h1>
						<div className="text-xs text-gray-500 mt-1">
							Range: <b>{dateFrom || '…'}</b> → <b>{dateTo || '…'}</b>
						</div>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<button
						type="button"
						className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
						onClick={loadPageData}
						disabled={loading || saving}
					>
						<RefreshCcw className="h-4 w-4" />
						Refresh
					</button>

					<button
						type="button"
						className="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-60"
						onClick={saveAll}
						disabled={loading || saving || filteredSortedRows.length === 0}
					>
						<Save className="h-4 w-4" />
						{saving ? 'Saving…' : 'Save All'}
					</button>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
				<StatCard
					title="Total Petty Cash"
					value={fmtINR(displaySummary.totalPettyCash)}
					icon={<IndianRupee className="h-4 w-4" />}
					panelClass="bg-blue-50 border-blue-100"
					iconClass="bg-blue-100 text-blue-700"
				/>

				<StatCard
					title="Total Spent"
					value={fmtINR(displaySummary.totalSpent)}
					icon={<TrendingDown className="h-4 w-4" />}
					panelClass="bg-rose-50 border-rose-100"
					iconClass="bg-rose-100 text-rose-700"
				/>

				<StatCard
					title="Petty Cash Balance"
					value={fmtINR(displaySummary.pettyCashBalance)}
					icon={<Scale className="h-4 w-4" />}
					panelClass="bg-amber-50 border-amber-100"
					iconClass="bg-amber-100 text-amber-700"
				/>

				<StatCard
					title="TPA Forecast"
					value={fmtINR(displaySummary.totalForecast)}
					icon={<TrendingUp className="h-4 w-4" />}
					panelClass="bg-emerald-50 border-emerald-100"
					iconClass="bg-emerald-100 text-emerald-700"
				/>

				<StatCard
					title="Net Profit / Loss"
					value={fmtINR(displaySummary.netProfitLoss)}
					icon={<Wallet className="h-4 w-4" />}
					panelClass="bg-violet-50 border-violet-100"
					iconClass="bg-violet-100 text-violet-700"
				/>

				<StatCard
					title="Total Case Transactions"
					value={String(displaySummary.totalTransactions)}
					icon={<ReceiptText className="h-4 w-4" />}
					panelClass="bg-slate-50 border-slate-200"
					iconClass="bg-slate-100 text-slate-700"
				/>
			</div>

			{err && (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
					<AlertTriangle className="h-4 w-4 mt-0.5" />
					<div>{err}</div>
				</div>
			)}

			{ok && (
				<div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
					{ok}
				</div>
			)}

			<div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
				<div className="p-4 border-b border-gray-200 flex flex-wrap items-end justify-between gap-3">
					<div>
						<div className="text-base font-semibold text-gray-900">Spend Analysis</div>
						<div className="text-xs text-gray-600 mt-1">
							Staff-wise and day-wise spend based on selected month.
						</div>
					</div>

					<div className="flex items-end gap-2">
						<div>
							<label className="block text-xs text-gray-600 mb-1">Selected Month</label>
							<div className="relative">
								<input
									type="month"
									className="border rounded px-2 py-2 pr-9 w-[150px] text-sm"
									value={chartMonth}
									onChange={(e) => setChartMonth(e.target.value)}
								/>
								<CalendarDays className="pointer-events-none absolute right-2 top-2.5 h-4 w-4 text-gray-400" />
							</div>
						</div>
					</div>
				</div>

				<div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-2">
					<div className="rounded-xl border border-gray-200 bg-white p-4">
						<div className="mb-3 flex items-center gap-2">
							<div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
								<BarChart3 className="h-4 w-4" />
							</div>
							<div>
								<div className="text-sm font-semibold text-gray-900">Staff-wise Spend</div>
								<div className="text-xs text-gray-500">Total spent by assigned staff</div>
							</div>
						</div>

						<div className="h-[280px]">
							{staffChartData.length === 0 ? (
								<div className="flex h-full items-center justify-center text-sm text-gray-500">
									No data for selected month.
								</div>
							) : (
								<ResponsiveContainer width="100%" height="100%">
									<BarChart data={staffChartData}>
										<CartesianGrid strokeDasharray="3 3" vertical={false} />
										<XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
										<YAxis tick={{ fontSize: 11 }} />
										<Tooltip
											formatter={(value: number) => [fmtINR(Number(value || 0)), 'Spent']}
										/>
										<Bar dataKey="amount" fill="#2563eb" radius={[6, 6, 0, 0]} />
									</BarChart>
								</ResponsiveContainer>
							)}
						</div>
					</div>

					<div className="rounded-xl border border-gray-200 bg-white p-4">
						<div className="mb-3 flex items-center gap-2">
							<div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
								<BarChart3 className="h-4 w-4" />
							</div>
							<div>
								<div className="text-sm font-semibold text-gray-900">Day-wise Spend</div>
								<div className="text-xs text-gray-500">Total spent by day in selected month</div>
							</div>
						</div>

						<div className="h-[280px]">
							{dayChartData.length === 0 ? (
								<div className="flex h-full items-center justify-center text-sm text-gray-500">
									No data for selected month.
								</div>
							) : (
								<ResponsiveContainer width="100%" height="100%">
									<BarChart data={dayChartData}>
										<CartesianGrid strokeDasharray="3 3" vertical={false} />
										<XAxis dataKey="label" tick={{ fontSize: 11 }} />
										<YAxis tick={{ fontSize: 11 }} />
										<Tooltip
											labelFormatter={(label) => `Day ${label}`}
											formatter={(value: number) => [fmtINR(Number(value || 0)), 'Spent']}
										/>
										<Bar dataKey="amount" fill="#059669" radius={[6, 6, 0, 0]} />
									</BarChart>
								</ResponsiveContainer>
							)}
						</div>
					</div>
				</div>
			</div>

			<div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
				<div className="p-4 border-b border-gray-200 flex flex-wrap items-end gap-2 justify-between">
					<div>
						<div className="text-base font-semibold text-gray-900">Appointment Expense Transactions</div>
						<div className="text-xs text-gray-600 mt-1">
							Assigned staff is taken from Outer Assignment. Enter only <b>Travel Cost</b> and <b>Accommodation Cost</b>.
						</div>
					</div>

					<div className="flex flex-wrap items-end gap-2">
						<div>
							<label className="block text-xs text-gray-600 mb-1">Lab</label>
							<select
								className="border rounded px-2 py-2 w-[130px] text-sm"
								value={labId}
								onChange={(e) => setLabId(e.target.value)}
							>
								<option value="">All Labs</option>
								{labs.map((l) => (
									<option key={l.id} value={l.id}>
										{l.nickName || l.name} {l.labCode ? `(${l.labCode})` : ''}
									</option>
								))}
							</select>
						</div>

						<div>
							<label className="block text-xs text-gray-600 mb-1">TPA Name</label>
							<select
								className="border rounded px-2 py-2 w-[150px] text-sm"
								value={vendorId}
								onChange={(e) => setVendorId(e.target.value)}
							>
								<option value="">All TPA</option>
								{vendors.map((v) => (
									<option key={v.id} value={v.id}>
										{vendorLabel(v)}
									</option>
								))}
							</select>
						</div>

						<div>
							<label className="block text-xs text-gray-600 mb-1">Staff</label>
							<select
								className="border rounded px-2 py-2 w-[190px] text-sm"
								value={staffId}
								onChange={(e) => setStaffId(e.target.value)}
							>
								<option value="">All Assigned Staff</option>
								{staffOptions.map((s) => (
									<option key={s.id} value={s.id}>
										{staffLabel(s)}
									</option>
								))}
							</select>
						</div>

						<div>
							<label className="block text-xs text-gray-600 mb-1">Visit Type</label>
							<select
								className="border rounded px-2 py-2 w-[110px] text-sm"
								value={visitType}
								onChange={(e) => setVisitType(normalizeVisitType(e.target.value))}
							>
								<option value="">All</option>
								<option value="CENTER">Center</option>
								<option value="HOME">Home</option>
							</select>
						</div>

						<div>
							<label className="block text-xs text-gray-600 mb-1">From</label>
							<input
								type="date"
								className="border rounded px-2 py-2 w-[135px] text-sm"
								value={dateFrom}
								onChange={(e) => setDateFrom(e.target.value)}
							/>
						</div>

						<div>
							<label className="block text-xs text-gray-600 mb-1">To</label>
							<input
								type="date"
								className="border rounded px-2 py-2 w-[135px] text-sm"
								value={dateTo}
								onChange={(e) => setDateTo(e.target.value)}
							/>
						</div>

						<button
							type="button"
							className="rounded border px-3 py-2 text-sm hover:bg-gray-50 h-[38px]"
							onClick={() => {
								setDateFrom('');
								setDateTo('');
								setStaffId('');
								setLabId('');
								setVendorId('');
								setVisitType('');
							}}
						>
							Clear
						</button>
					</div>
				</div>

				<div className="p-4">
					<div className="w-full overflow-x-auto">
						<div className="max-h-[720px] overflow-y-auto rounded border border-gray-200">
							<table className="w-full min-w-[2100px]">
								<thead className="sticky top-0 z-10 bg-white">
									<tr className="border-b bg-gray-50">
										<SortTh k="appointmentDate" label="Appointment" />
										<SortTh k="patientName" label="Patient Name" />
										<SortTh k="visitType" label="Visit Type" />
										<SortTh k="location" label="Location" />
										<SortTh k="staff" label="Assigned Staff" />
										<SortTh k="travelCost" label="Travel Cost" />
										<SortTh k="accommodationCost" label="Accommodation Cost" />
										<SortTh k="totalSpent" label="Total Spent" />
										<SortTh k="tpaForecastAmount" label="TPA Forecast" />
										<SortTh k="profitLossAmount" label="Profit / Loss" />
										<SortTh k="profitLossStatus" label="P/L Status" />
										<th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
											Remarks
										</th>
									</tr>
								</thead>

								<tbody>
									{loading ? (
										<tr>
											<td colSpan={12} className="px-3 py-6 text-center text-sm text-gray-500">
												Loading…
											</td>
										</tr>
									) : filteredSortedRows.length === 0 ? (
										<tr>
											<td colSpan={12} className="px-3 py-6 text-center text-sm text-gray-500">
												No rows found for the current filter.
											</td>
										</tr>
									) : (
										filteredSortedRows.map((r) => {
											const totalSpent = currentTotalSpent(r);
											const profitLoss = currentProfitLoss(r);
											const profitStatus = currentProfitStatus(r);
											const changed = isRowChanged(r);

											return (
												<tr key={r.appointmentId} className={`border-t hover:bg-gray-50 ${changed ? 'bg-amber-50/30' : ''}`}>
													<td className="px-3 py-2 text-sm whitespace-nowrap">
														<div className="font-medium text-gray-900">
															{formatDateOnly(r.appointmentDate)}{' '}
															<span className="text-gray-500">{formatTime(r.appointmentDate)}</span>
														</div>
														<div className="text-xs text-gray-500">{r.labName || '-'}</div>
													</td>

													<td className="px-3 py-2 text-sm whitespace-nowrap">{r.patientName}</td>
													<td className="px-3 py-2 text-sm whitespace-nowrap">{normalizeVisitType(r.visitType || '') || '-'}</td>
													<td className="px-3 py-2 text-sm">{r.location || '-'}</td>

													<td className="px-3 py-2 text-sm">
														<div className="w-[135px] rounded border border-gray-200 bg-gray-50 px-2 py-2 text-sm text-gray-800 truncate">
															{staffLabel({ name: r.staffName, userId: r.staffUserId })}
														</div>
													</td>

													<td className="px-3 py-2 text-sm">
														<input
															type="number"
															step="0.01"
															min="0"
															className="w-[95px] border rounded px-2 py-1.5"
															value={draftTravel[r.appointmentId] ?? '0'}
															onChange={(e) =>
																setDraftTravel((p) => ({ ...p, [r.appointmentId]: e.target.value }))
															}
														/>
													</td>

													<td className="px-3 py-2 text-sm">
														<input
															type="number"
															step="0.01"
															min="0"
															className="w-[115px] border rounded px-2 py-1.5"
															value={draftAccommodation[r.appointmentId] ?? '0'}
															onChange={(e) =>
																setDraftAccommodation((p) => ({
																	...p,
																	[r.appointmentId]: e.target.value,
																}))
															}
														/>
													</td>

													<td className="px-3 py-2 text-sm font-medium whitespace-nowrap">
														{fmtINR(totalSpent)}
													</td>

													<td className="px-3 py-2 text-sm font-medium whitespace-nowrap">
														{fmtINR(num(r.tpaForecastAmount))}
													</td>

													<td
														className={`px-3 py-2 text-sm font-semibold whitespace-nowrap ${profitLoss > 0 ? 'text-green-600' : profitLoss < 0 ? 'text-red-600' : 'text-gray-700'
															}`}
													>
														{fmtINR(profitLoss)}
													</td>

													<td className="px-3 py-2 text-sm whitespace-nowrap">
														<span
															className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${profitStatus === 'Profit'
																	? 'bg-green-100 text-green-700'
																	: profitStatus === 'Loss'
																		? 'bg-red-100 text-red-700'
																		: 'bg-gray-100 text-gray-700'
																}`}
														>
															{profitStatus}
														</span>
													</td>

													<td className="px-3 py-2 text-sm">
														<input
															className="w-[230px] border rounded px-2 py-1.5"
															placeholder="Enter remarks"
															value={draftRemark[r.appointmentId] ?? ''}
															onChange={(e) =>
																setDraftRemark((p) => ({ ...p, [r.appointmentId]: e.target.value }))
															}
														/>
													</td>
												</tr>
											);
										})
									)}
								</tbody>
							</table>
						</div>
					</div>

					<div className="text-xs text-gray-500 mt-3">
						Petty Cash Balance = Total Petty Cash - Total Spent. Profit / Loss = TPA Forecast - Total Spent.
					</div>
				</div>
			</div>
		</div>
	);
}

function StatCard({
	title,
	value,
	icon,
	panelClass,
	iconClass,
}: {
	title: string;
	value: string;
	icon: React.ReactNode;
	panelClass: string;
	iconClass: string;
}) {
	return (
		<div className={`rounded-xl border px-3 py-3 shadow-sm ${panelClass}`}>
			<div className="flex items-start justify-between gap-2">
				<div className="min-w-0">
					<div className="text-[11px] leading-4 text-gray-600 truncate">{title}</div>
					<div className="mt-1.5 text-xl font-bold leading-6 text-gray-900">{value}</div>
				</div>
				<div className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
					{icon}
				</div>
			</div>
		</div>
	);
}