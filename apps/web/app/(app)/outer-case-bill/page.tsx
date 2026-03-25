'use client';

import { useEffect, useMemo, useState } from 'react';
import {
	ChevronDown,
	ChevronUp,
	RefreshCw,
	Save,
	X,
} from 'lucide-react';

type FilterOption = {
	id: string;
	label: string;
};

type OuterCaseBillRow = {
	id: string;
	appointmentDate: string;
	labId: string;
	vendorId: string;
	lab: string;
	tpa: string;
	client: string;
	status: string;
	outerPayment: number;
	location: string;
	// remarks: string;
	paymentStatus: string;
};

type DraftState = Record<
	string,
	{
		outerPayment: string;
		// remarks: string;
		paymentStatus: string;
		saving?: boolean;
	}
>;

type SortKey =
	| 'appointmentDate'
	| 'lab'
	| 'tpa'
	| 'client'
	| 'status'
	| 'outerPayment'
	| 'location'
	| 'remarks'
	| 'paymentStatus';

type SortDirection = 'asc' | 'desc';

function formatDate(value: string) {
	if (!value) return '';
	const dt = new Date(value);
	if (Number.isNaN(dt.getTime())) return '';
	return dt.toLocaleDateString('en-IN', {
		day: '2-digit',
		month: '2-digit',
		year: 'numeric',
	});
}

function toMoney(value: number) {
	return Number(value || 0).toFixed(2);
}

export default function OuterCaseBillPage() {
	const today = useMemo(() => {
		const d = new Date();
		const yyyy = d.getFullYear();
		const mm = String(d.getMonth() + 1).padStart(2, '0');
		const dd = String(d.getDate()).padStart(2, '0');
		return `${yyyy}-${mm}-${dd}`;
	}, []);

	const currentMonthStart = useMemo(() => {
		const d = new Date();
		const yyyy = d.getFullYear();
		const mm = String(d.getMonth() + 1).padStart(2, '0');
		return `${yyyy}-${mm}-01`;
	}, []);

	const [filtersLoading, setFiltersLoading] = useState(true);
	const [tableLoading, setTableLoading] = useState(true);
	const [error, setError] = useState('');

	const [labs, setLabs] = useState<FilterOption[]>([]);
	const [vendors, setVendors] = useState<FilterOption[]>([]);
	const [locations, setLocations] = useState<string[]>([]);
	const [paymentStatuses, setPaymentStatuses] = useState<string[]>([]);

	const [labId, setLabId] = useState('');
	const [vendorId, setVendorId] = useState('');
	const [location, setLocation] = useState('');
	const [paymentStatusFilter, setPaymentStatusFilter] = useState('');
	const [from, setFrom] = useState(currentMonthStart);
	const [to, setTo] = useState(today);

	const [rows, setRows] = useState<OuterCaseBillRow[]>([]);
	const [drafts, setDrafts] = useState<DraftState>({});
	const [sortKey, setSortKey] = useState<SortKey>('appointmentDate');
	const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

	useEffect(() => {
		let active = true;

		(async () => {
			try {
				setFiltersLoading(true);
				const res = await fetch('/api/outer-case-bill/filters', { cache: 'no-store' });
				const json = await res.json();

				if (!active) return;

				if (!json?.success) {
					throw new Error(json?.message || 'Failed to load filters');
				}

				setLabs(json.labs || []);
				setVendors(json.vendors || []);
				setLocations(json.locations || []);
				setPaymentStatuses(json.paymentStatuses || ['Paid', 'Not Paid']);
			} catch (e) {
				console.error(e);
			} finally {
				if (active) setFiltersLoading(false);
			}
		})();

		return () => {
			active = false;
		};
	}, []);

	async function loadRows() {
		try {
			setTableLoading(true);
			setError('');

			const params = new URLSearchParams();
			if (labId) params.set('labId', labId);
			if (vendorId) params.set('vendorId', vendorId);
			if (location) params.set('location', location);
			if (paymentStatusFilter) params.set('paymentStatus', paymentStatusFilter);
			if (from) params.set('from', from);
			if (to) params.set('to', to);

			const res = await fetch(`/api/outer-case-bill?${params.toString()}`, {
				cache: 'no-store',
			});
			const json = await res.json();

			if (!json?.success) {
				throw new Error(json?.message || 'Failed to load outer case bill data');
			}

			const nextRows: OuterCaseBillRow[] = json.rows || [];
			setRows(nextRows);

			const nextDrafts: DraftState = {};
			for (const row of nextRows) {
				nextDrafts[row.id] = {
					outerPayment:
						row.outerPayment === null || row.outerPayment === undefined
							? ''
							: String(row.outerPayment),
					// remarks: row.remarks || '',
					paymentStatus: row.paymentStatus || 'Not Paid',
				};
			}
			setDrafts(nextDrafts);
		} catch (e: any) {
			console.error(e);
			setError(e?.message || 'Something went wrong');
			setRows([]);
			setDrafts({});
		} finally {
			setTableLoading(false);
		}
	}

	useEffect(() => {
		loadRows();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [labId, vendorId, location, paymentStatusFilter, from, to]);

	function updateDraft(
		id: string,
		field: 'outerPayment' | 'remarks' | 'paymentStatus',
		value: string
	) {
		setDrafts((prev) => ({
			...prev,
			[id]: {
				...prev[id],
				[field]: value,
			},
		}));
	}

	async function saveRow(id: string) {
		const draft = drafts[id];
		if (!draft) return;

		setDrafts((prev) => ({
			...prev,
			[id]: {
				...prev[id],
				saving: true,
			},
		}));

		try {
			const res = await fetch(`/api/outer-case-bill/${id}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					outerPayment: draft.outerPayment,
					// remarks: draft.remarks,
					paymentStatus: draft.paymentStatus,
				}),
			});

			const json = await res.json();

			if (!json?.success) {
				throw new Error(json?.message || 'Save failed');
			}

			setRows((prev) =>
				prev.map((row) =>
					row.id === id
						? {
							...row,
							outerPayment: json.row.outerPayment,
							// remarks: json.row.remarks,
							paymentStatus: json.row.paymentStatus,
						}
						: row
				)
			);

			setDrafts((prev) => ({
				...prev,
				[id]: {
					outerPayment: String(json.row.outerPayment ?? ''),
					// remarks: json.row.remarks || '',
					paymentStatus: json.row.paymentStatus || 'Not Paid',
					saving: false,
				},
			}));

			await loadRows();
		} catch (e: any) {
			console.error(e);
			alert(e?.message || 'Failed to save');
			setDrafts((prev) => ({
				...prev,
				[id]: {
					...prev[id],
					saving: false,
				},
			}));
		}
	}

	function clearFilters() {
		setLabId('');
		setVendorId('');
		setLocation('');
		setPaymentStatusFilter('');
		setFrom(currentMonthStart);
		setTo(today);
	}

	function handleSort(key: SortKey) {
		if (sortKey === key) {
			setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
			return;
		}
		setSortKey(key);
		setSortDirection('asc');
	}

	const sortedRows = useMemo(() => {
		const copy = [...rows];

		copy.sort((a, b) => {
			let aValue: any = a[sortKey];
			let bValue: any = b[sortKey];

			if (sortKey === 'appointmentDate') {
				aValue = new Date(a.appointmentDate).getTime();
				bValue = new Date(b.appointmentDate).getTime();
			}

			if (sortKey === 'outerPayment') {
				aValue = Number(a.outerPayment || 0);
				bValue = Number(b.outerPayment || 0);
			}

			if (typeof aValue === 'string') aValue = aValue.toLowerCase();
			if (typeof bValue === 'string') bValue = bValue.toLowerCase();

			if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
			if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
			return 0;
		});

		return copy;
	}, [rows, sortKey, sortDirection]);

	const totalCases = rows.length;

	const forecastAmount = rows.reduce((sum, row) => sum + (Number(row.outerPayment) || 0), 0);

	const paidAmount = rows.reduce((sum, row) => {
		return (row.paymentStatus || '').toLowerCase() === 'paid'
			? sum + (Number(row.outerPayment) || 0)
			: sum;
	}, 0);

	const notPaidAmount = forecastAmount - paidAmount;

	function SortIcon({ column }: { column: SortKey }) {
		if (sortKey !== column) {
			return <ChevronDown className="h-4 w-4 opacity-30" />;
		}
		return sortDirection === 'asc' ? (
			<ChevronUp className="h-4 w-4" />
		) : (
			<ChevronDown className="h-4 w-4" />
		);
	}

	return (
		<div className="p-4 md:p-5">
			<div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<div>
					<h1 className="text-2xl font-semibold text-slate-900">Outer Case Bill</h1>
					<p className="text-sm text-slate-500">
						View and update billing details for Outer appointments.
					</p>
				</div>

				<div className="flex gap-2">
					<button
						onClick={loadRows}
						className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
					>
						<RefreshCw className="h-4 w-4" />
						Refresh
					</button>
				</div>
			</div>

			<div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-4">
				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<div className="text-sm text-slate-500">Total No. of Cases</div>
					<div className="mt-2 text-2xl font-semibold text-slate-900">{totalCases}</div>
				</div>

				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<div className="text-sm text-slate-500">Outer Payment Forecast</div>
					<div className="mt-2 text-2xl font-semibold text-slate-900">
						{toMoney(forecastAmount)}
					</div>
				</div>

				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<div className="text-sm text-slate-500">Paid Amount</div>
					<div className="mt-2 text-2xl font-semibold text-emerald-700">
						{toMoney(paidAmount)}
					</div>
				</div>

				<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
					<div className="text-sm text-slate-500">Not Paid Amount</div>
					<div className="mt-2 text-2xl font-semibold text-amber-700">
						{toMoney(notPaidAmount)}
					</div>
				</div>
			</div>

			<div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
				<div className="flex flex-wrap xl:flex-nowrap items-end gap-2 overflow-x-auto">
					<div className="min-w-[120px] max-w-[120px]">
						<label className="mb-1 block text-sm font-medium text-slate-700">Lab</label>
						<select
							value={labId}
							onChange={(e) => setLabId(e.target.value)}
							disabled={filtersLoading}
							className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-slate-500"
						>
							<option value="">All Labs</option>
							{labs.map((lab) => (
								<option key={lab.id} value={lab.id}>
									{lab.label}
								</option>
							))}
						</select>
					</div>

					<div className="min-w-[120px] max-w-[120px]">
						<label className="mb-1 block text-sm font-medium text-slate-700">TPA</label>
						<select
							value={vendorId}
							onChange={(e) => setVendorId(e.target.value)}
							disabled={filtersLoading}
							className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-slate-500"
						>
							<option value="">All TPA</option>
							{vendors.map((vendor) => (
								<option key={vendor.id} value={vendor.id}>
									{vendor.label}
								</option>
							))}
						</select>
					</div>

					<div className="min-w-[120px] max-w-[120px]">
						<label className="mb-1 block text-sm font-medium text-slate-700">Location</label>
						<select
							value={location}
							onChange={(e) => setLocation(e.target.value)}
							disabled={filtersLoading}
							className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-slate-500"
						>
							<option value="">All Locations</option>
							{locations.map((loc) => (
								<option key={loc} value={loc}>
									{loc}
								</option>
							))}
						</select>
					</div>

					<div className="min-w-[130px] max-w-[130px]">
						<label className="mb-1 block text-sm font-medium text-slate-700">
							Payment Status
						</label>
						<select
							value={paymentStatusFilter}
							onChange={(e) => setPaymentStatusFilter(e.target.value)}
							disabled={filtersLoading}
							className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-slate-500"
						>
							<option value="">All</option>
							{paymentStatuses.map((status) => (
								<option key={status} value={status}>
									{status}
								</option>
							))}
						</select>
					</div>

					<div className="min-w-[125px] max-w-[125px]">
						<label className="mb-1 block text-sm font-medium text-slate-700">From</label>
						<input
							type="date"
							value={from}
							onChange={(e) => setFrom(e.target.value)}
							className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-slate-500"
						/>
					</div>

					<div className="min-w-[125px] max-w-[125px]">
						<label className="mb-1 block text-sm font-medium text-slate-700">To</label>
						<input
							type="date"
							value={to}
							onChange={(e) => setTo(e.target.value)}
							className="h-9 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-slate-500"
						/>
					</div>

					<div className="min-w-[80px] max-w-[80px]">
						<label className="mb-1 block text-sm font-medium text-transparent">Clear</label>
						<button
							onClick={clearFilters}
							className="inline-flex h-9 w-full items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
						>
							<X className="h-4 w-4" />
							Clear
						</button>
					</div>
				</div>
			</div>

			<div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div className="border-b border-slate-200 px-4 py-3">
					<h2 className="text-sm font-semibold text-slate-700">Outer Case Billing Records</h2>
				</div>

				{error ? (
					<div className="p-4 text-sm text-red-600">{error}</div>
				) : tableLoading ? (
					<div className="p-4 text-sm text-slate-500">Loading...</div>
				) : rows.length === 0 ? (
					<div className="p-4 text-sm text-slate-500">No outer case billing records found.</div>
				) : (
					<div className="max-h-[58vh] overflow-auto">
						<table className="min-w-full border-collapse text-sm">
							<thead className="sticky top-0 z-10 bg-slate-50">
								<tr>
									<th className="border-b border-slate-200 px-3 py-2 text-left">
										<button
											onClick={() => handleSort('appointmentDate')}
											className="flex items-center gap-1 font-semibold text-slate-700"
										>
											Appointment Date <SortIcon column="appointmentDate" />
										</button>
									</th>
									<th className="border-b border-slate-200 px-3 py-2 text-left">
										<button
											onClick={() => handleSort('lab')}
											className="flex items-center gap-1 font-semibold text-slate-700"
										>
											Lab <SortIcon column="lab" />
										</button>
									</th>
									<th className="border-b border-slate-200 px-3 py-2 text-left">
										<button
											onClick={() => handleSort('tpa')}
											className="flex items-center gap-1 font-semibold text-slate-700"
										>
											TPA <SortIcon column="tpa" />
										</button>
									</th>
									<th className="border-b border-slate-200 px-3 py-2 text-left">
										<button
											onClick={() => handleSort('client')}
											className="flex items-center gap-1 font-semibold text-slate-700"
										>
											Client <SortIcon column="client" />
										</button>
									</th>
									<th className="border-b border-slate-200 px-3 py-2 text-left">
										<button
											onClick={() => handleSort('status')}
											className="flex items-center gap-1 font-semibold text-slate-700"
										>
											Status <SortIcon column="status" />
										</button>
									</th>
									<th className="border-b border-slate-200 px-3 py-2 text-left">
										<button
											onClick={() => handleSort('outerPayment')}
											className="flex items-center gap-1 font-semibold text-slate-700"
										>
											Outer Payment <SortIcon column="outerPayment" />
										</button>
									</th>
									<th className="border-b border-slate-200 px-3 py-2 text-left">
										<button
											onClick={() => handleSort('location')}
											className="flex items-center gap-1 font-semibold text-slate-700"
										>
											Location <SortIcon column="location" />
										</button>
									</th>
									{/* <th className="border-b border-slate-200 px-3 py-2 text-left">
										<button
											onClick={() => handleSort('remarks')}
											className="flex items-center gap-1 font-semibold text-slate-700"
										>
											Remarks <SortIcon column="remarks" />
										</button>
									</th> */}
									<th className="border-b border-slate-200 px-3 py-2 text-left">
										<button
											onClick={() => handleSort('paymentStatus')}
											className="flex items-center gap-1 font-semibold text-slate-700"
										>
											Payment Status <SortIcon column="paymentStatus" />
										</button>
									</th>
									<th className="border-b border-slate-200 px-3 py-2 text-left font-semibold text-slate-700">
										Action
									</th>
								</tr>
							</thead>

							<tbody>
								{sortedRows.map((row) => {
									const draft = drafts[row.id] || {
										outerPayment: '',
										// remarks: '',
										paymentStatus: 'Not Paid',
										saving: false,
									};

									return (
										<tr key={row.id} className="hover:bg-slate-50/60">
											<td className="border-b border-slate-100 px-3 py-2 text-slate-700">
												{formatDate(row.appointmentDate)}
											</td>
											<td className="border-b border-slate-100 px-3 py-2 text-slate-700">
												{row.lab}
											</td>
											<td className="border-b border-slate-100 px-3 py-2 text-slate-700">
												{row.tpa}
											</td>
											<td className="border-b border-slate-100 px-3 py-2 text-slate-700">
												{row.client}
											</td>
											<td className="border-b border-slate-100 px-3 py-2 text-slate-700">
												{row.status}
											</td>
											<td className="border-b border-slate-100 px-3 py-2">
												<input
													type="number"
													step="0.01"
													value={draft.outerPayment}
													onChange={(e) =>
														updateDraft(row.id, 'outerPayment', e.target.value)
													}
													className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500"
												/>
											</td>
											<td className="border-b border-slate-100 px-3 py-2 text-slate-700">
												{row.location}
											</td>
											{/* <td className="border-b border-slate-100 px-3 py-2">
												<input
													type="text"
													value={draft.remarks}
													onChange={(e) => updateDraft(row.id, 'remarks', e.target.value)}
													className="w-44 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500"
												/>
											</td> */}
											<td className="border-b border-slate-100 px-3 py-2">
												<select
													value={draft.paymentStatus}
													onChange={(e) =>
														updateDraft(row.id, 'paymentStatus', e.target.value)
													}
													className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-slate-500"
												>
													<option value="Paid">Paid</option>
													<option value="Not Paid">Not Paid</option>
												</select>
											</td>
											<td className="border-b border-slate-100 px-3 py-2">
												<button
													onClick={() => saveRow(row.id)}
													disabled={!!draft.saving}
													className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
												>
													<Save className="h-4 w-4" />
													{draft.saving ? 'Saving...' : 'Save'}
												</button>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}