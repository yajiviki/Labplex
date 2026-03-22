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
	CalendarDays,
	Columns3,
	FileDown,
} from 'lucide-react';
import {
	ResponsiveContainer,
	BarChart,
	Bar,
	CartesianGrid,
	XAxis,
	YAxis,
	Tooltip,
	Cell,
	LabelList,
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
	serviceType?: string | null;
	location?: string | null;
	status?: string | null;
	visitNumber: number;
	actualAmount: number;
	advanceAmount: number;
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
	totalPettyCash: number;
	totalSpent: number;
	totalForecast: number;
	totalActualAmount: number;
	totalAdvanceAmount: number;
	pendingPettyCash: number;
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

type StaffChartRow = {
	id: string;
	name: string;
	amount: number;
	caseCount: number;
	label: string;
};

type DayChartRow = {
	id: string;
	day: string;
	label: string;
	amount: number;
	caseCount: number;
	displayLabel: string;
};

type ColKey =
	| 'appointment'
	| 'patientName'
	| 'visitType'
	| 'location'
	| 'assignedStaff'
	| 'visitNumber'
	| 'actualAmount'
	| 'advanceAmount'
	| 'travelCost'
	| 'accommodationCost'
	| 'totalSpent'
	| 'tpaForecast'
	| 'profitLoss'
	| 'profitLossStatus'
	| 'remarks';

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

function ymdMonthStart() {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
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

function normalizeServiceType(v?: string | null) {
	const s = (v || '').toUpperCase().trim();
	if (s === 'LOCAL') return 'LOCAL';
	if (s === 'OUTER') return 'OUTER';
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

function fmtNum(n: number) {
	return new Intl.NumberFormat('en-IN', {
		maximumFractionDigits: 0,
	}).format(Number.isFinite(n) ? n : 0);
}

function fmtPdfAmount(n: number) {
	const val = Number.isFinite(n) ? n : 0;
	return val.toFixed(2);
}

function num(v: string | number | null | undefined) {
	const n = Number(v ?? 0);
	return Number.isFinite(n) ? n : 0;
}

function round2(n: number) {
	return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
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

function chartValueLabel(amount: number, caseCount: number) {
	return `${fmtNum(amount)} (${caseCount} case${caseCount > 1 ? 's' : ''})`;
}

const ALL_COLUMNS: Array<{ key: ColKey; label: string }> = [
	{ key: 'appointment', label: 'Appointment' },
	{ key: 'patientName', label: 'Patient Name' },
	{ key: 'visitType', label: 'Visit Type' },
	{ key: 'location', label: 'Location' },
	{ key: 'assignedStaff', label: 'Assigned Staff' },
	{ key: 'visitNumber', label: 'Visit No' },
	{ key: 'actualAmount', label: 'Actual Amount' },
	{ key: 'advanceAmount', label: 'Advance Amount' },
	{ key: 'travelCost', label: 'Travel Cost' },
	{ key: 'accommodationCost', label: 'Accommodation Cost' },
	{ key: 'totalSpent', label: 'Total Spent' },
	{ key: 'tpaForecast', label: 'TPA Forecast' },
	{ key: 'profitLoss', label: 'Profit / Loss' },
	{ key: 'profitLossStatus', label: 'P/L Status' },
	{ key: 'remarks', label: 'Remarks' },
];

const DEFAULT_VISIBLE_COLUMNS: ColKey[] = [
	'appointment',
	'patientName',
	'assignedStaff',
	'visitNumber',
	'actualAmount',
	'advanceAmount',
	'travelCost',
	'accommodationCost',
	'totalSpent',
	'profitLoss',
	'remarks',
];

function StatCard({
	title,
	value,
	icon,
	panelClass = '',
	iconClass = '',
}: {
	title: string;
	value: string;
	icon: React.ReactNode;
	panelClass?: string;
	iconClass?: string;
}) {
	return (
		<div className={`rounded-2xl border p-4 shadow-sm ${panelClass}`}>
			<div className="flex items-start justify-between gap-3">
				<div>
					<div className="text-xs font-medium text-gray-600">{title}</div>
					<div className="mt-2 text-lg font-semibold text-gray-900">{value}</div>
				</div>
				<div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${iconClass}`}>
					{icon}
				</div>
			</div>
		</div>
	);
}

export default function TravelSettlementPage() {
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [exportingPdf, setExportingPdf] = useState(false);

	const [labs, setLabs] = useState<Lab[]>([]);
	const [vendors, setVendors] = useState<Vendor[]>([]);
	const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
	const [rows, setRows] = useState<SettlementRow[]>([]);

	const [dateFrom, setDateFrom] = useState<string>(() => ymdMonthStart());
	const [dateTo, setDateTo] = useState<string>(() => ymdToday());
	const [chartMonth, setChartMonth] = useState<string>(() => ymToday());

	const [err, setErr] = useState<string | null>(null);
	const [ok, setOk] = useState<string | null>(null);

	const [labId, setLabId] = useState<string>('');
	const [vendorId, setVendorId] = useState<string>('');
	const [staffId, setStaffId] = useState<string>('');
	const [visitType, setVisitType] = useState<string>('');
	const [serviceType, setServiceType] = useState<string>('');

	const [activeStaffChartId, setActiveStaffChartId] = useState<string>('');
	const [activeDayChartId, setActiveDayChartId] = useState<string>('');
	const [showColumnMenu, setShowColumnMenu] = useState(false);
	const [visibleColumns, setVisibleColumns] = useState<ColKey[]>(DEFAULT_VISIBLE_COLUMNS);

	const [summary, setSummary] = useState<SettlementSummary>({
		totalTransactions: 0,
		totalPettyCash: 0,
		totalSpent: 0,
		totalForecast: 0,
		totalActualAmount: 0,
		totalAdvanceAmount: 0,
		pendingPettyCash: 0,
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
		| 'visitNumber'
		| 'actualAmount'
		| 'advanceAmount'
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
			setSortDir(
				k === 'patientName' || k === 'location' || k === 'staff' || k === 'visitNumber'
					? 'asc'
					: 'desc'
			);
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
		if (serviceType) sp.set('serviceType', serviceType);
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
				totalPettyCash: 0,
				totalSpent: 0,
				totalForecast: 0,
				totalActualAmount: 0,
				totalAdvanceAmount: 0,
				pendingPettyCash: 0,
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

			for (let i = 0; i < apiRows.length; i += 1) {
				const row = apiRows[i];
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
	}, [labId, vendorId, staffId, visitType, serviceType, dateFrom, dateTo]);

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
		return round2(currentTravel(r) + currentAccommodation(r));
	}

	function currentActualAmount(r: SettlementRow) {
		return round2(num(r.actualAmount));
	}

	function currentAdvanceAmount(r: SettlementRow) {
		return round2(num(r.advanceAmount));
	}

	function currentProfitLoss(r: SettlementRow) {
		return round2(currentActualAmount(r) - currentTotalSpent(r));
	}

	function currentProfitStatus(r: SettlementRow) {
		const pl = currentProfitLoss(r);
		if (pl > 0) return 'Profit';
		if (pl < 0) return 'Loss';
		return 'Break-even';
	}

	function hasSpend(r: SettlementRow) {
		return currentTotalSpent(r) > 0;
	}

	function isRowChanged(r: SettlementRow) {
		return (
			num(r.travelCost) !== currentTravel(r) ||
			num(r.accommodationCost) !== currentAccommodation(r) ||
			(r.remarks ?? '') !== currentRemark(r)
		);
	}

	const sortedRows = useMemo(() => {
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
				case 'visitNumber':
					return num(r.visitNumber);
				case 'actualAmount':
					return currentActualAmount(r);
				case 'advanceAmount':
					return currentAdvanceAmount(r);
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

	const chartRows = useMemo(() => {
		return sortedRows.filter(
			(r) => getMonthKeyFromIso(r.appointmentDate) === chartMonth && hasSpend(r)
		);
	}, [sortedRows, chartMonth, draftTravel, draftAccommodation]);

	const staffChartData = useMemo<StaffChartRow[]>(() => {
		const map = new Map<string, StaffChartRow>();

		for (let i = 0; i < chartRows.length; i += 1) {
			const row = chartRows[i];
			const id = row.staffId || '__UNASSIGNED__';
			const name = staffLabel({ name: row.staffName, userId: row.staffUserId });
			const spent = currentTotalSpent(row);

			if (!map.has(id)) {
				map.set(id, {
					id,
					name,
					amount: 0,
					caseCount: 0,
					label: '',
				});
			}

			const curr = map.get(id)!;
			curr.amount += spent;
			curr.caseCount += 1;
		}

		return Array.from(map.values())
			.map((r) => ({
				...r,
				label: chartValueLabel(r.amount, r.caseCount),
			}))
			.sort((a, b) => b.amount - a.amount);
	}, [chartRows, draftTravel, draftAccommodation]);

	const dayChartData = useMemo<DayChartRow[]>(() => {
		const map = new Map<string, DayChartRow>();

		for (let i = 0; i < chartRows.length; i += 1) {
			const row = chartRows[i];
			const id = getDayKeyFromIso(row.appointmentDate);
			if (!id) continue;
			const spent = currentTotalSpent(row);

			if (!map.has(id)) {
				map.set(id, {
					id,
					day: id,
					label: id.slice(8, 10),
					amount: 0,
					caseCount: 0,
					displayLabel: '',
				});
			}

			const curr = map.get(id)!;
			curr.amount += spent;
			curr.caseCount += 1;
		}

		return Array.from(map.values())
			.map((r) => ({
				...r,
				displayLabel: chartValueLabel(r.amount, r.caseCount),
			}))
			.sort((a, b) => a.day.localeCompare(b.day));
	}, [chartRows, draftTravel, draftAccommodation]);

	const filteredSortedRows = useMemo(() => {
		let list = [...sortedRows];

		if (activeStaffChartId || activeDayChartId) {
			list = list.filter((r) => hasSpend(r));
		}

		if (activeStaffChartId) {
			list = list.filter((r) => (r.staffId || '__UNASSIGNED__') === activeStaffChartId);
		}

		if (activeDayChartId) {
			list = list.filter((r) => getDayKeyFromIso(r.appointmentDate) === activeDayChartId);
		}

		return list;
	}, [sortedRows, activeStaffChartId, activeDayChartId, draftTravel, draftAccommodation]);

	const changedRows = useMemo(
		() => filteredSortedRows.filter((r) => isRowChanged(r)),
		[filteredSortedRows]
	);

	const tableTotals = useMemo(() => {
		return {
			actualAmount: round2(filteredSortedRows.reduce((sum, r) => sum + currentActualAmount(r), 0)),
			advanceAmount: round2(filteredSortedRows.reduce((sum, r) => sum + currentAdvanceAmount(r), 0)),
			travelCost: round2(filteredSortedRows.reduce((sum, r) => sum + currentTravel(r), 0)),
			accommodationCost: round2(
				filteredSortedRows.reduce((sum, r) => sum + currentAccommodation(r), 0)
			),
			totalSpent: round2(filteredSortedRows.reduce((sum, r) => sum + currentTotalSpent(r), 0)),
			profitLoss: round2(filteredSortedRows.reduce((sum, r) => sum + currentProfitLoss(r), 0)),
		};
	}, [filteredSortedRows]);

	const displaySummary = useMemo(() => {
		const totalSpent = round2(filteredSortedRows.reduce((sum, r) => sum + currentTotalSpent(r), 0));
		const totalForecast = round2(filteredSortedRows.reduce((sum, r) => sum + num(r.tpaForecastAmount), 0));
		const totalActualAmount = round2(filteredSortedRows.reduce((sum, r) => sum + currentActualAmount(r), 0));
		const totalAdvanceAmount = round2(filteredSortedRows.reduce((sum, r) => sum + currentAdvanceAmount(r), 0));
		const netProfitLoss = round2(totalActualAmount - totalSpent);
		const totalPettyCash = round2(pettyCashKpis.pendingBalance);
		const pettyCashBalance = round2(totalPettyCash - totalSpent);

		return {
			totalTransactions: filteredSortedRows.length,
			totalPettyCash,
			totalSpent,
			pettyCashBalance,
			totalForecast,
			totalActualAmount,
			totalAdvanceAmount,
			netProfitLoss,
		};
	}, [filteredSortedRows, pettyCashKpis, draftTravel, draftAccommodation]);

	function handleStaffBarClick(row: StaffChartRow) {
		setActiveStaffChartId((prev) => (prev === row.id ? '' : row.id));
	}

	function handleDayBarClick(row: DayChartRow) {
		setActiveDayChartId((prev) => (prev === row.id ? '' : row.id));
	}

	function toggleColumn(key: ColKey) {
		setVisibleColumns((prev) => {
			if (prev.includes(key)) {
				if (prev.length === 1) return prev;
				return prev.filter((c) => c !== key);
			}
			return [...prev, key];
		});
	}

	function visibleCol(key: ColKey) {
		return visibleColumns.includes(key);
	}

	function getPdfCellValue(r: SettlementRow, key: ColKey) {
		switch (key) {
			case 'appointment':
				return `${formatDateOnly(r.appointmentDate)} ${formatTime(r.appointmentDate)}`.trim();
			case 'patientName':
				return r.patientName || '-';
			case 'visitType':
				return normalizeVisitType(r.visitType || '') || '-';
			case 'location':
				return r.location || '-';
			case 'assignedStaff':
				return staffLabel({ name: r.staffName, userId: r.staffUserId });
			case 'visitNumber':
				return String(r.visitNumber || 1);
			case 'actualAmount':
				return fmtPdfAmount(currentActualAmount(r));
			case 'advanceAmount':
				return fmtPdfAmount(currentAdvanceAmount(r));
			case 'travelCost':
				return fmtPdfAmount(currentTravel(r));
			case 'accommodationCost':
				return fmtPdfAmount(currentAccommodation(r));
			case 'totalSpent':
				return fmtPdfAmount(currentTotalSpent(r));
			case 'tpaForecast':
				return fmtPdfAmount(num(r.tpaForecastAmount));
			case 'profitLoss':
				return fmtPdfAmount(currentProfitLoss(r));
			case 'profitLossStatus':
				return currentProfitStatus(r);
			case 'remarks':
				return currentRemark(r) || '-';
			default:
				return '-';
		}
	}

	async function exportPdf() {
		try {
			const pdfRows = filteredSortedRows.filter(
				(r) => currentTravel(r) > 0 || currentAccommodation(r) > 0
			);

			if (!pdfRows.length) {
				setErr('No spend rows available for export.');
				return;
			}

			if (!visibleColumns.length) {
				setErr('Please select at least one column to export.');
				return;
			}

			setErr(null);
			setOk(null);
			setExportingPdf(true);

			const doc = new jsPDF('l', 'mm', 'a4');

			doc.setFontSize(14);
			doc.text('Travel Expense Settlement', 14, 12);

			doc.setFontSize(9);
			doc.text(`Range: ${dateFrom || 'All'} to ${dateTo || 'All'}`, 14, 18);

			const chartFilterText = [
				activeStaffChartId ? 'Staff Chart Filter Applied' : '',
				activeDayChartId ? 'Day Chart Filter Applied' : '',
			]
				.filter(Boolean)
				.join(' | ');

			if (chartFilterText) {
				doc.text(chartFilterText, 14, 23);
			}

			const head = [visibleColumns.map((c) => ALL_COLUMNS.find((x) => x.key === c)?.label || c)];

			const body = pdfRows.map((row) =>
				visibleColumns.map((c) => getPdfCellValue(row, c))
			);

			autoTable(doc, {
				startY: chartFilterText ? 28 : 23,
				head,
				body,
				styles: {
					fontSize: 8,
					cellPadding: 2,
					overflow: 'linebreak',
				},
				headStyles: {
					fillColor: [18, 255, 147],
					textColor: [0, 0, 0],
					fontStyle: 'bold',
				},
				bodyStyles: {
					textColor: [31, 41, 55],
				},
				margin: { left: 8, right: 8 },
				tableWidth: 'auto',
			});

			doc.save(`travel-expense-settlement-${new Date().toISOString().slice(0, 10)}.pdf`);
			setOk(`PDF exported successfully (${pdfRows.length} spend rows).`);
		} catch (e: any) {
			setErr(e?.message || 'PDF export failed');
		} finally {
			setExportingPdf(false);
		}
	}

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

	const STICKY_TOP = 'top-14';
	const TABLE_VIEWPORT_HEIGHT = 'h-[calc(100vh-340px)]';
	const TABLE_MIN_HEIGHT = 'min-h-[420px]';

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
						disabled={loading || saving || exportingPdf}
					>
						<RefreshCcw className="h-4 w-4" />
						Refresh
					</button>

					<button
						type="button"
						className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
						onClick={exportPdf}
						disabled={loading || saving || exportingPdf || filteredSortedRows.length === 0}
					>
						<FileDown className="h-4 w-4" />
						{exportingPdf ? 'Exporting…' : 'Export PDF'}
					</button>

					<button
						type="button"
						className="inline-flex items-center gap-2 rounded-xl bg-blue-600 text-white px-4 py-2 text-sm hover:bg-blue-700 disabled:opacity-60"
						onClick={saveAll}
						disabled={loading || saving || exportingPdf || filteredSortedRows.length === 0}
					>
						<Save className="h-4 w-4" />
						{saving ? 'Saving…' : 'Save All'}
					</button>
				</div>
			</div>

			<div className={`sticky ${STICKY_TOP} z-30 -mx-4 px-4 pt-3 pb-3 bg-[#f8fafc]/95 backdrop-blur supports-[backdrop-filter]:bg-[#f8fafc]/85 border-b border-gray-200 shadow-sm`}>
				<div className="space-y-4">
					<div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
						<div className="p-4 border-b border-gray-200 flex flex-wrap items-end gap-2 justify-between">
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
									<label className="block text-xs text-gray-600 mb-1">Service Type</label>
									<select
										className="border rounded px-2 py-2 w-[120px] text-sm"
										value={serviceType}
										onChange={(e) => setServiceType(normalizeServiceType(e.target.value))}
									>
										<option value="">All</option>
										<option value="LOCAL">Local</option>
										<option value="OUTER">Outer</option>
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
										setServiceType('');
										setActiveStaffChartId('');
										setActiveDayChartId('');
									}}
								>
									Clear
								</button>
							</div>
						</div>
					</div>

					<div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
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
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
				<div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
					<div className="mb-4 flex items-center justify-between gap-3">
						<div>
							<div className="text-base font-semibold text-gray-900">Spend by Staff</div>
							<div className="text-xs text-gray-500 mt-1">
								Chart month and table stay connected
							</div>
						</div>

						<div className="flex items-center gap-2">
							<div className="relative">
								<CalendarDays className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
								<input
									type="month"
									className="rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
									value={chartMonth}
									onChange={(e) => setChartMonth(e.target.value)}
								/>
							</div>

							{activeStaffChartId ? (
								<button
									type="button"
									className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
									onClick={() => setActiveStaffChartId('')}
								>
									Clear Staff Filter
								</button>
							) : null}
						</div>
					</div>

					<div className="h-[300px]">
						{staffChartData.length === 0 ? (
							<div className="flex h-full items-center justify-center text-sm text-gray-500">
								No data for selected month.
							</div>
						) : (
							<ResponsiveContainer width="100%" height="100%">
								<BarChart data={staffChartData}>
									<CartesianGrid strokeDasharray="3 3" vertical={false} />
									<XAxis dataKey="name" tick={{ fontSize: 11 }} />
									<YAxis tick={{ fontSize: 11 }} />
									<Tooltip
										formatter={(value: number, _name, props: any) => [
											`${fmtINR(Number(value || 0))} (${props?.payload?.caseCount || 0} case${(props?.payload?.caseCount || 0) > 1 ? 's' : ''})`,
											'Spent',
										]}
									/>
									<Bar
										dataKey="amount"
										radius={[6, 6, 0, 0]}
										onClick={(data) => handleStaffBarClick(data as unknown as StaffChartRow)}
										cursor="pointer"
									>
										{staffChartData.map((entry) => (
											<Cell
												key={entry.id}
												fill={activeStaffChartId === entry.id ? '#1d4ed8' : '#2563eb'}
											/>
										))}
										<LabelList
											dataKey="label"
											position="top"
											formatter={(value: string) => value}
											style={{ fontSize: 10 }}
										/>
									</Bar>
								</BarChart>
							</ResponsiveContainer>
						)}
					</div>
				</div>

				<div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
					<div className="mb-4 flex items-center justify-between gap-3">
						<div>
							<div className="text-base font-semibold text-gray-900">Spend by Day</div>
							<div className="text-xs text-gray-500 mt-1">
								Click a bar to filter the table
							</div>
						</div>

						<div className="flex items-center gap-2">
							<div className="relative">
								<CalendarDays className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
								<input
									type="month"
									className="rounded-xl border border-gray-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
									value={chartMonth}
									onChange={(e) => setChartMonth(e.target.value)}
								/>
							</div>

							{activeDayChartId ? (
								<button
									type="button"
									className="rounded border px-2 py-1 text-xs hover:bg-gray-50"
									onClick={() => setActiveDayChartId('')}
								>
									Clear Day Filter
								</button>
							) : null}
						</div>
					</div>

					<div className="h-[300px]">
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
										formatter={(value: number, _name, props: any) => [
											`${fmtINR(Number(value || 0))} (${props?.payload?.caseCount || 0} case${(props?.payload?.caseCount || 0) > 1 ? 's' : ''})`,
											'Spent',
										]}
									/>
									<Bar
										dataKey="amount"
										radius={[6, 6, 0, 0]}
										onClick={(data) => handleDayBarClick(data as unknown as DayChartRow)}
										cursor="pointer"
									>
										{dayChartData.map((entry) => (
											<Cell
												key={entry.id}
												fill={activeDayChartId === entry.id ? '#047857' : '#059669'}
											/>
										))}
										<LabelList
											dataKey="displayLabel"
											position="top"
											formatter={(value: string) => value}
											style={{ fontSize: 10 }}
										/>
									</Bar>
								</BarChart>
							</ResponsiveContainer>
						)}
					</div>
				</div>
			</div>

			<div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
				<div className="p-4 border-b border-gray-200 flex flex-wrap items-end gap-2 justify-between">
					<div>
						<div className="flex flex-wrap items-center gap-3">
							<div className="text-base font-semibold text-gray-900">
								Appointment Expense Transactions
							</div>
							<div className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-sm font-bold text-indigo-700 border border-indigo-100">
								Total Advance Amount: {fmtINR(tableTotals.advanceAmount)}
							</div>
						</div>
						<div className="text-xs text-gray-600 mt-1">
							Assigned staff is taken from Outer Assignment. Enter only <b>Travel Cost</b> and <b>Accommodation Cost</b>.
							{activeStaffChartId || activeDayChartId ? (
								<span className="ml-2 text-blue-700 font-medium">Chart filter applied</span>
							) : null}
						</div>
					</div>

					<div className="flex flex-wrap items-end gap-2">
						<div className="relative">
							<button
								type="button"
								className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-gray-50 h-[38px]"
								onClick={() => setShowColumnMenu((p) => !p)}
							>
								<Columns3 className="h-4 w-4" />
								Columns
							</button>

							{showColumnMenu && (
								<div className="absolute right-0 z-20 mt-2 w-[260px] rounded-xl border bg-white p-3 shadow-lg">
									<div className="text-xs font-semibold text-gray-700 mb-2">Visible Columns</div>
									<div className="max-h-[320px] overflow-auto space-y-2">
										{ALL_COLUMNS.map((col) => (
											<label key={col.key} className="flex items-center gap-2 text-sm text-gray-700">
												<input
													type="checkbox"
													checked={visibleColumns.includes(col.key)}
													onChange={() => toggleColumn(col.key)}
												/>
												<span>{col.label}</span>
											</label>
										))}
									</div>
								</div>
							)}
						</div>
					</div>
				</div>

				<div className={`${TABLE_VIEWPORT_HEIGHT} ${TABLE_MIN_HEIGHT} overflow-auto rounded-b-2xl border-t border-gray-200`}>
					<table className="w-full min-w-[1800px]">
						<thead className="sticky top-0 z-10 bg-white">
							<tr className="border-b bg-gray-50">
								{visibleCol('appointment') && <SortTh k="appointmentDate" label="Appointment" />}
								{visibleCol('patientName') && <SortTh k="patientName" label="Patient Name" />}
								{visibleCol('visitType') && <SortTh k="visitType" label="Visit Type" />}
								{visibleCol('location') && <SortTh k="location" label="Location" />}
								{visibleCol('assignedStaff') && <SortTh k="staff" label="Assigned Staff" />}
								{visibleCol('visitNumber') && <SortTh k="visitNumber" label="Visit No" />}
								{visibleCol('actualAmount') && <SortTh k="actualAmount" label="Actual Amount" />}
								{visibleCol('advanceAmount') && <SortTh k="advanceAmount" label="Advance Amount" />}
								{visibleCol('travelCost') && <SortTh k="travelCost" label="Travel Cost" />}
								{visibleCol('accommodationCost') && <SortTh k="accommodationCost" label="Accommodation Cost" />}
								{visibleCol('totalSpent') && <SortTh k="totalSpent" label="Total Spent" />}
								{visibleCol('tpaForecast') && <SortTh k="tpaForecastAmount" label="TPA Forecast" />}
								{visibleCol('profitLoss') && <SortTh k="profitLossAmount" label="Profit / Loss" />}
								{visibleCol('profitLossStatus') && <SortTh k="profitLossStatus" label="P/L Status" />}
								{visibleCol('remarks') && (
									<th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
										Remarks
									</th>
								)}
							</tr>
						</thead>

						<tbody>
							{loading ? (
								<tr>
									<td colSpan={visibleColumns.length} className="px-3 py-6 text-center text-sm text-gray-500">
										Loading…
									</td>
								</tr>
							) : filteredSortedRows.length === 0 ? (
								<tr>
									<td colSpan={visibleColumns.length} className="px-3 py-6 text-center text-sm text-gray-500">
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
										<tr
											key={r.appointmentId}
											className={`border-t hover:bg-gray-50 ${changed ? 'bg-amber-50/30' : ''}`}
										>
											{visibleCol('appointment') && (
												<td className="px-3 py-2 text-sm w-[145px] min-w-[145px] max-w-[145px] whitespace-normal leading-5 align-top">
													<div className="font-medium text-gray-900 break-words">
														{formatDateOnly(r.appointmentDate)}
													</div>
													<div className="text-xs text-gray-500">{formatTime(r.appointmentDate)}</div>
													<div className="text-xs text-gray-500 break-words line-clamp-1">
														{r.labName || '-'}
													</div>
												</td>
											)}

											{visibleCol('patientName') && (
												<td className="px-3 py-2 text-sm w-[180px] min-w-[180px] max-w-[180px] whitespace-normal break-words leading-5">
													<div className="line-clamp-2">{r.patientName}</div>
												</td>
											)}

											{visibleCol('visitType') && (
												<td className="px-3 py-2 text-sm w-[120px] min-w-[120px] max-w-[120px] whitespace-nowrap">
													{normalizeVisitType(r.visitType || '') || '-'}
												</td>
											)}

											{visibleCol('location') && (
												<td className="px-3 py-2 text-sm w-[150px] min-w-[150px] max-w-[150px] whitespace-nowrap">
													{r.location || '-'}
												</td>
											)}

											{visibleCol('assignedStaff') && (
												<td className="px-3 py-2 text-sm w-[170px] min-w-[170px] max-w-[170px] whitespace-normal break-words leading-5 align-top">
													<div className="line-clamp-2">
														{staffLabel({ name: r.staffName, userId: r.staffUserId })}
													</div>
												</td>
											)}

											{visibleCol('visitNumber') && (
												<td className="px-3 py-2 text-sm whitespace-nowrap text-center">
													<span className="inline-flex min-w-[32px] items-center justify-center rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
														{r.visitNumber || 1}
													</span>
												</td>
											)}

											{visibleCol('actualAmount') && (
												<td className="px-3 py-2 text-sm w-[120px] min-w-[120px] max-w-[120px] whitespace-nowrap font-medium text-cyan-700 text-right">
													{fmtINR(currentActualAmount(r))}
												</td>
											)}

											{visibleCol('advanceAmount') && (
												<td className="px-3 py-2 text-sm w-[120px] min-w-[120px] max-w-[120px] whitespace-nowrap font-medium text-indigo-700 text-right">
													{fmtINR(currentAdvanceAmount(r))}
												</td>
											)}

											{visibleCol('travelCost') && (
												<td className="px-3 py-2 text-sm w-[120px] min-w-[120px] max-w-[120px] whitespace-nowrap">
													<input
														type="number"
														step="0.01"
														className="w-[100px] rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:border-blue-500 text-right"
														value={draftTravel[r.appointmentId] ?? ''}
														onChange={(e) =>
															setDraftTravel((prev) => ({
																...prev,
																[r.appointmentId]: e.target.value,
															}))
														}
													/>
												</td>
											)}

											{visibleCol('accommodationCost') && (
												<td className="px-3 py-2 text-sm w-[130px] min-w-[130px] max-w-[130px] whitespace-nowrap">
													<input
														type="number"
														step="0.01"
														className="w-[110px] rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:border-blue-500 text-right"
														value={draftAccommodation[r.appointmentId] ?? ''}
														onChange={(e) =>
															setDraftAccommodation((prev) => ({
																...prev,
																[r.appointmentId]: e.target.value,
															}))
														}
													/>
												</td>
											)}

											{visibleCol('totalSpent') && (
												<td className="px-3 py-2 text-sm w-[120px] min-w-[120px] max-w-[120px] whitespace-nowrap font-medium text-indigo-700 text-right">
													{fmtINR(totalSpent)}
												</td>
											)}

											{visibleCol('tpaForecast') && (
												<td className="px-3 py-2 text-sm w-[120px] min-w-[120px] max-w-[120px] whitespace-nowrap font-medium text-indigo-700 text-right">
													{fmtINR(num(r.tpaForecastAmount))}
												</td>
											)}

											{visibleCol('profitLoss') && (
												<td
													className={`px-3 py-2 text-sm whitespace-nowrap font-semibold text-right ${profitLoss > 0
															? 'text-emerald-700'
															: profitLoss < 0
																? 'text-rose-700'
																: 'text-gray-700'
														}`}
												>
													{fmtINR(profitLoss)}
												</td>
											)}

											{visibleCol('profitLossStatus') && (
												<td className="px-3 py-2 text-sm whitespace-nowrap">
													<span
														className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${profitStatus === 'Profit'
																? 'bg-emerald-100 text-emerald-700'
																: profitStatus === 'Loss'
																	? 'bg-rose-100 text-rose-700'
																	: 'bg-gray-100 text-gray-700'
															}`}
													>
														{profitStatus}
													</span>
												</td>
											)}

											{visibleCol('remarks') && (
												<td className="px-3 py-2 text-sm">
													<input
														type="text"
														className="w-[220px] rounded border border-gray-200 px-2 py-1 text-sm outline-none focus:border-blue-500"
														value={draftRemark[r.appointmentId] ?? ''}
														onChange={(e) =>
															setDraftRemark((prev) => ({
																...prev,
																[r.appointmentId]: e.target.value,
															}))
														}
													/>
												</td>
											)}
										</tr>
									);
								})
							)}
						</tbody>

						<tfoot className="sticky bottom-0 z-10 bg-amber-50 border-t-2 border-amber-200">
							<tr>
								{visibleCol('appointment') && (
									<td className="px-3 py-3 text-sm font-bold text-gray-900">Total</td>
								)}
								{visibleCol('patientName') && <td className="px-3 py-3" />}
								{visibleCol('visitType') && <td className="px-3 py-3" />}
								{visibleCol('location') && <td className="px-3 py-3" />}
								{visibleCol('assignedStaff') && <td className="px-3 py-3" />}
								{visibleCol('visitNumber') && <td className="px-3 py-3" />}

								{visibleCol('actualAmount') && (
									<td className="px-3 py-3 text-sm font-bold text-cyan-700 whitespace-nowrap text-right">
										{fmtINR(tableTotals.actualAmount)}
									</td>
								)}

								{visibleCol('advanceAmount') && (
									<td className="px-3 py-3 text-sm font-bold text-indigo-700 whitespace-nowrap text-right">
										{fmtINR(tableTotals.advanceAmount)}
									</td>
								)}

								{visibleCol('travelCost') && (
									<td className="px-3 py-3 text-sm font-bold text-gray-900 whitespace-nowrap text-right">
										{fmtINR(tableTotals.travelCost)}
									</td>
								)}

								{visibleCol('accommodationCost') && (
									<td className="px-3 py-3 text-sm font-bold text-gray-900 whitespace-nowrap text-right">
										{fmtINR(tableTotals.accommodationCost)}
									</td>
								)}

								{visibleCol('totalSpent') && (
									<td className="px-3 py-3 text-sm font-bold text-rose-700 whitespace-nowrap text-right">
										{fmtINR(tableTotals.totalSpent)}
									</td>
								)}

								{visibleCol('tpaForecast') && <td className="px-3 py-3" />}

								{visibleCol('profitLoss') && (
									<td
										className={`px-3 py-3 text-sm font-bold whitespace-nowrap text-right ${tableTotals.profitLoss > 0
												? 'text-emerald-700'
												: tableTotals.profitLoss < 0
													? 'text-rose-700'
													: 'text-gray-700'
											}`}
									>
										{fmtINR(tableTotals.profitLoss)}
									</td>
								)}

								{visibleCol('profitLossStatus') && <td className="px-3 py-3" />}
								{visibleCol('remarks') && <td className="px-3 py-3" />}
							</tr>
						</tfoot>
					</table>
				</div>
			</div>
		</div>
	);
}