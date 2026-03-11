'use client';

import { useEffect, useMemo, useState } from 'react';
import {
	CalendarDays,
	RefreshCcw,
	Save,
	AlertTriangle,
	ChevronDown,
	ChevronUp,
	Wallet,
} from 'lucide-react';

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

type UserRow = {
	id: string;
	name: string;
	userId?: string | null;
	phone?: string | null;
	role?: string | null;
	labId?: string | null;
	lab?: { nickName?: string | null; name?: string | null; labCode?: string | null } | null;
};

type SettlementRow = {
	id: string;
	appointmentId: string;
	staffId: string;
	staffName?: string;
	patientName: string;
	vendorId: string;
	vendorName?: string;
	labId: string;
	labName?: string;
	appointmentDate: string | null;
	visitType?: string | null;
	location?: string | null;
	status?: string | null;
	pettyCashGiven: number;
	travelCost: number;
	accommodationCost: number;
	totalSpent: number;
	tpaReceivedAmount: number;
	pettyCashBalance: number;
	profitLossAmount: number;
	settlementStatus: string;
	profitLossStatus: string;
	remarks: string;
	createdAt?: string | null;
	updatedAt?: string | null;
};

type Summary = {
	totalRows: number;
	totalPettyCash: number;
	totalSpent: number;
	totalReceived: number;
	totalBalance: number;
	netProfitLoss: number;
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

function userLabel(u: UserRow) {
	const uid = u.userId ? ` (${u.userId})` : '';
	return `${u.name}${uid}`;
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

export default function TravelSettlementPage() {
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);

	const [labs, setLabs] = useState<Lab[]>([]);
	const [vendors, setVendors] = useState<Vendor[]>([]);
	const [users, setUsers] = useState<UserRow[]>([]);
	const [rows, setRows] = useState<SettlementRow[]>([]);

	const [err, setErr] = useState<string | null>(null);
	const [ok, setOk] = useState<string | null>(null);

	const [labId, setLabId] = useState<string>('');
	const [vendorId, setVendorId] = useState<string>('');
	const [staffId, setStaffId] = useState<string>('');
	const [visitType, setVisitType] = useState<string>('');
	const [dateFrom, setDateFrom] = useState<string>(() => ymdToday());
	const [dateTo, setDateTo] = useState<string>(() => ymdToday());

	const [summary, setSummary] = useState<Summary>({
		totalRows: 0,
		totalPettyCash: 0,
		totalSpent: 0,
		totalReceived: 0,
		totalBalance: 0,
		netProfitLoss: 0,
	});

	const [draftPettyCash, setDraftPettyCash] = useState<Record<string, string>>({});
	const [draftTravel, setDraftTravel] = useState<Record<string, string>>({});
	const [draftAccommodation, setDraftAccommodation] = useState<Record<string, string>>({});
	const [draftRemark, setDraftRemark] = useState<Record<string, string>>({});
	const [draftStaffId, setDraftStaffId] = useState<Record<string, string>>({});

	type SortKey =
		| 'appointmentDate'
		| 'patientName'
		| 'visitType'
		| 'location'
		| 'staff'
		| 'pettyCashGiven'
		| 'travelCost'
		| 'accommodationCost'
		| 'totalSpent'
		| 'tpaReceivedAmount'
		| 'pettyCashBalance'
		| 'profitLossAmount'
		| 'settlementStatus'
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

	async function loadRows() {
		setLoading(true);
		setErr(null);
		setOk(null);

		try {
			const q = buildQuery();
			const res = await fetch(`/api/travel-settlements${q}`, { cache: 'no-store' });
			const data = await res.json().catch(() => null);

			if (!res.ok || !data?.ok) {
				setErr(data?.error || 'Load failed');
				setRows([]);
				setUsers([]);
				return;
			}

			const apiRows = Array.isArray(data.rows) ? data.rows : [];
			const apiUsers = Array.isArray(data.users) ? data.users : [];
			const apiSummary = data.summary || {
				totalRows: 0,
				totalPettyCash: 0,
				totalSpent: 0,
				totalReceived: 0,
				totalBalance: 0,
				netProfitLoss: 0,
			};

			setRows(apiRows);
			setUsers(apiUsers);
			setSummary(apiSummary);

			const p: Record<string, string> = {};
			const t: Record<string, string> = {};
			const a: Record<string, string> = {};
			const r: Record<string, string> = {};
			const s: Record<string, string> = {};

			for (const row of apiRows) {
				p[row.appointmentId] = String(row.pettyCashGiven ?? 0);
				t[row.appointmentId] = String(row.travelCost ?? 0);
				a[row.appointmentId] = String(row.accommodationCost ?? 0);
				r[row.appointmentId] = row.remarks ?? '';
				s[row.appointmentId] = row.staffId ?? '';
			}

			setDraftPettyCash(p);
			setDraftTravel(t);
			setDraftAccommodation(a);
			setDraftRemark(r);
			setDraftStaffId(s);
		} catch (e: any) {
			setErr(e?.message || 'Network error');
			setRows([]);
			setUsers([]);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		loadLabs();
		loadVendors();
		loadRows();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		loadRows();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [labId, vendorId, staffId, visitType, dateFrom, dateTo]);

	function currentPettyCash(r: SettlementRow) {
		return num(draftPettyCash[r.appointmentId]);
	}

	function currentTravel(r: SettlementRow) {
		return num(draftTravel[r.appointmentId]);
	}

	function currentAccommodation(r: SettlementRow) {
		return num(draftAccommodation[r.appointmentId]);
	}

	function currentRemark(r: SettlementRow) {
		return draftRemark[r.appointmentId] ?? r.remarks ?? '';
	}

	function currentStaffId(r: SettlementRow) {
		return draftStaffId[r.appointmentId] ?? r.staffId ?? '';
	}

	function currentTotalSpent(r: SettlementRow) {
		return currentTravel(r) + currentAccommodation(r);
	}

	function currentBalance(r: SettlementRow) {
		return currentPettyCash(r) - currentTotalSpent(r);
	}

	function currentProfitLoss(r: SettlementRow) {
		return num(r.tpaReceivedAmount) - currentTotalSpent(r);
	}

	function currentSettlementStatus(r: SettlementRow) {
		const bal = currentBalance(r);
		if (bal > 0) return 'Balance to return';
		if (bal < 0) return 'Extra claim';
		return 'Settled';
	}

	function currentProfitStatus(r: SettlementRow) {
		const pl = currentProfitLoss(r);
		if (pl > 0) return 'Profit';
		if (pl < 0) return 'Loss';
		return 'Break-even';
	}

	function isRowChanged(r: SettlementRow) {
		return (
			num(r.pettyCashGiven) !== currentPettyCash(r) ||
			num(r.travelCost) !== currentTravel(r) ||
			num(r.accommodationCost) !== currentAccommodation(r) ||
			(r.remarks ?? '') !== currentRemark(r) ||
			(r.staffId ?? '') !== currentStaffId(r)
		);
	}

	const userMap = useMemo(() => {
		const m = new Map<string, UserRow>();
		for (const u of users) m.set(u.id, u);
		return m;
	}, [users]);

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
					return (userMap.get(currentStaffId(r))?.name || r.staffName || '').toLowerCase();
				case 'pettyCashGiven':
					return currentPettyCash(r);
				case 'travelCost':
					return currentTravel(r);
				case 'accommodationCost':
					return currentAccommodation(r);
				case 'totalSpent':
					return currentTotalSpent(r);
				case 'tpaReceivedAmount':
					return num(r.tpaReceivedAmount);
				case 'pettyCashBalance':
					return currentBalance(r);
				case 'profitLossAmount':
					return currentProfitLoss(r);
				case 'settlementStatus':
					return currentSettlementStatus(r).toLowerCase();
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
	}, [rows, sortKey, sortDir, draftPettyCash, draftTravel, draftAccommodation, draftRemark, draftStaffId, userMap]);

	const changedRows = useMemo(() => filteredSortedRows.filter((r) => isRowChanged(r)), [filteredSortedRows]);

	const displaySummary = useMemo(() => {
		return filteredSortedRows.reduce(
			(acc, r) => {
				acc.totalRows += 1;
				acc.totalPettyCash += currentPettyCash(r);
				acc.totalSpent += currentTotalSpent(r);
				acc.totalReceived += num(r.tpaReceivedAmount);
				acc.totalBalance += currentBalance(r);
				acc.netProfitLoss += currentProfitLoss(r);
				return acc;
			},
			{
				totalRows: 0,
				totalPettyCash: 0,
				totalSpent: 0,
				totalReceived: 0,
				totalBalance: 0,
				netProfitLoss: 0,
			}
		);
	}, [filteredSortedRows, draftPettyCash, draftTravel, draftAccommodation]);

	async function saveAll() {
		setErr(null);
		setOk(null);

		const items = changedRows.map((r) => ({
			appointmentId: r.appointmentId,
			staffId: currentStaffId(r),
			pettyCashGiven: currentPettyCash(r),
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
			await loadRows();
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
			<div className="rounded-xl border bg-white px-5 py-4 shadow-sm flex items-start justify-between gap-4">
				<div className="flex items-start gap-3">
					<div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand-600">
						<Wallet className="h-5 w-5" />
					</div>
					<div>
						<h1 className="text-2xl md:text-3xl font-bold tracking-tight">Travel Expense Settlement</h1>
						<div className="text-xs text-gray-500 mt-1">
							Range: <b>{dateFrom || '…'}</b> → <b>{dateTo || '…'}</b>
							{visitType ? (
								<span>
									{' '}· Visit: <b>{visitType}</b>
								</span>
							) : null}
						</div>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<button
						type="button"
						className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
						onClick={loadRows}
						disabled={loading || saving}
					>
						<RefreshCcw className="h-4 w-4" />
						Refresh
					</button>

					<button
						type="button"
						className="inline-flex items-center gap-2 rounded bg-brand text-white px-4 py-2 text-sm disabled:opacity-60"
						onClick={saveAll}
						disabled={loading || saving || filteredSortedRows.length === 0}
					>
						<Save className="h-4 w-4" />
						{saving ? 'Saving…' : 'Save All'}
					</button>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
				<Card title="Total Rows" value={String(displaySummary.totalRows)} />
				<Card title="Total Petty Cash" value={fmtINR(displaySummary.totalPettyCash)} />
				<Card title="Total Spent" value={fmtINR(displaySummary.totalSpent)} />
				<Card title="TPA Received" value={fmtINR(displaySummary.totalReceived)} />
				<Card title="Petty Cash Balance" value={fmtINR(displaySummary.totalBalance)} />
				<Card title="Net Profit / Loss" value={fmtINR(displaySummary.netProfitLoss)} />
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

			<div className="rounded-xl border bg-white shadow-sm">
				<div className="p-4 border-b flex flex-wrap items-end gap-2 justify-between">
					<div>
						<div className="text-base font-semibold">Settlement List</div>
						<div className="text-xs text-gray-600 mt-1">
							Enter <b>Petty Cash</b>, <b>Travel Cost</b>, <b>Accommodation Cost</b>, then click <b>Save All</b>.
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
								className="border rounded px-2 py-2 w-[170px] text-sm"
								value={staffId}
								onChange={(e) => setStaffId(e.target.value)}
							>
								<option value="">All Staff</option>
								{users.map((u) => (
									<option key={u.id} value={u.id}>
										{userLabel(u)}
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
						<div className="max-h-[720px] overflow-y-auto rounded border">
							<table className="w-full min-w-[2500px]">
								<thead className="sticky top-0 z-10 bg-white">
									<tr className="border-b bg-gray-50">
										<SortTh k="appointmentDate" label="Appointment" />
										<SortTh k="patientName" label="Patient Name" />
										<SortTh k="visitType" label="Visit Type" />
										<SortTh k="location" label="Location" />
										<SortTh k="staff" label="Staff" />
										<SortTh k="pettyCashGiven" label="Petty Cash Given" />
										<SortTh k="travelCost" label="Travel Cost" />
										<SortTh k="accommodationCost" label="Accommodation Cost" />
										<SortTh k="totalSpent" label="Total Spent" />
										<SortTh k="tpaReceivedAmount" label="TPA Received" />
										<SortTh k="pettyCashBalance" label="Petty Cash Balance" />
										<SortTh k="profitLossAmount" label="Profit / Loss" />
										<SortTh k="settlementStatus" label="Settlement Status" />
										<SortTh k="profitLossStatus" label="P/L Status" />
										<th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
											Remarks
										</th>
									</tr>
								</thead>

								<tbody>
									{loading ? (
										<tr>
											<td colSpan={15} className="px-3 py-6 text-center text-sm text-gray-500">
												Loading…
											</td>
										</tr>
									) : filteredSortedRows.length === 0 ? (
										<tr>
											<td colSpan={15} className="px-3 py-6 text-center text-sm text-gray-500">
												No rows found for the current filter.
											</td>
										</tr>
									) : (
										filteredSortedRows.map((r) => {
											const totalSpent = currentTotalSpent(r);
											const balance = currentBalance(r);
											const profitLoss = currentProfitLoss(r);
											const settlementStatus = currentSettlementStatus(r);
											const profitStatus = currentProfitStatus(r);
											const changed = isRowChanged(r);
											const selectedStaffId = currentStaffId(r);

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
														<select
															className="w-full border rounded px-2 py-1.5 bg-white min-w-[180px]"
															value={selectedStaffId}
															onChange={(e) =>
																setDraftStaffId((p) => ({ ...p, [r.appointmentId]: e.target.value }))
															}
														>
															<option value="">Select Staff</option>
															{users.map((u) => (
																<option key={u.id} value={u.id}>
																	{userLabel(u)}
																</option>
															))}
														</select>
													</td>

													<td className="px-3 py-2 text-sm">
														<input
															type="number"
															step="0.01"
															min="0"
															className="w-[140px] border rounded px-2 py-1.5"
															value={draftPettyCash[r.appointmentId] ?? '0'}
															onChange={(e) =>
																setDraftPettyCash((p) => ({ ...p, [r.appointmentId]: e.target.value }))
															}
														/>
													</td>

													<td className="px-3 py-2 text-sm">
														<input
															type="number"
															step="0.01"
															min="0"
															className="w-[140px] border rounded px-2 py-1.5"
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
															className="w-[160px] border rounded px-2 py-1.5"
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
														{fmtINR(num(r.tpaReceivedAmount))}
													</td>

													<td className={`px-3 py-2 text-sm font-medium whitespace-nowrap ${balance < 0 ? 'text-red-600' : 'text-gray-900'}`}>
														{fmtINR(balance)}
													</td>

													<td className={`px-3 py-2 text-sm font-semibold whitespace-nowrap ${profitLoss > 0 ? 'text-green-600' : profitLoss < 0 ? 'text-red-600' : 'text-gray-700'}`}>
														{fmtINR(profitLoss)}
													</td>

													<td className="px-3 py-2 text-sm whitespace-nowrap">
														<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${settlementStatus === 'Balance to return'
																? 'bg-blue-100 text-blue-700'
																: settlementStatus === 'Extra claim'
																	? 'bg-red-100 text-red-700'
																	: 'bg-gray-100 text-gray-700'
															}`}>
															{settlementStatus}
														</span>
													</td>

													<td className="px-3 py-2 text-sm whitespace-nowrap">
														<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${profitStatus === 'Profit'
																? 'bg-green-100 text-green-700'
																: profitStatus === 'Loss'
																	? 'bg-red-100 text-red-700'
																	: 'bg-gray-100 text-gray-700'
															}`}>
															{profitStatus}
														</span>
													</td>

													<td className="px-3 py-2 text-sm">
														<input
															className="w-[260px] border rounded px-2 py-1.5"
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
						TPA Received is pulled from Appointment Extra Rs. Profit / Loss = TPA Received - Total Spent.
					</div>
				</div>
			</div>
		</div>
	);
}

function Card({ title, value }: { title: string; value: string }) {
	return (
		<div className="rounded-xl border bg-white px-4 py-4 shadow-sm">
			<div className="text-xs text-gray-500">{title}</div>
			<div className="mt-2 text-xl font-bold text-gray-900">{value}</div>
		</div>
	);
}