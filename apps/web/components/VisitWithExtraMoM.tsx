'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Download, Info, X } from 'lucide-react';

type BucketMetric = {
	count: number;
	amount: number; // fallback / legacy
	travelAmount?: number;
	testAmount?: number;
	totalAmount?: number;
};

type ApiRow = {
	month: string;
	centerWithExtra: BucketMetric;
	localHomeWithExtra: BucketMetric;
	outerHomeWithExtra: BucketMetric;
};

type ApiResp = { rows: ApiRow[] };

type DetailRow = {
	id: string;
	apptAt: string;
	labName: string | null;
	tpaName: string | null;
	insuranceNickName: string | null;
	clientName: string | null;
	clientRef: string | null;
	status: string | null;
	serviceType: string | null;
	visitType: string | null;
	extraChargeRs: number | null;
	testAmountRs: number | null;
	totalAmountRs: number | null;
};

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
	const res = await fetch(url, {
		...init,
		headers: {
			'Content-Type': 'application/json',
			...(init?.headers || {}),
		},
	});

	const ct = res.headers.get('content-type') || '';
	const text = await res.text();

	if (!ct.includes('application/json')) {
		throw new Error(`HTTP ${res.status} from ${url}. Expected JSON but got: ${text.slice(0, 160)}`);
	}

	const data = JSON.parse(text);

	if (!res.ok) {
		throw new Error((data?.error as string) || `HTTP ${res.status}`);
	}

	return data as T;
}

function money(n: any) {
	const num = Number(n);
	return Number.isFinite(num) ? num : 0;
}

function currency(n: number) {
	return `₹${money(n).toLocaleString()}`;
}

function bucketTravel(b?: BucketMetric) {
	return money(b?.travelAmount);
}

function bucketTest(b?: BucketMetric) {
	return money(b?.testAmount);
}

function bucketTotal(b?: BucketMetric) {
	const explicitTotal = money(b?.totalAmount);
	if (explicitTotal > 0) return explicitTotal;

	const travel = money(b?.travelAmount);
	const test = money(b?.testAmount);
	if (travel > 0 || test > 0) return travel + test;

	return money(b?.amount);
}

function detailTotal(r: DetailRow) {
	const explicit = money(r.totalAmountRs);
	if (explicit > 0) return explicit;
	return money(r.extraChargeRs) + money(r.testAmountRs);
}

export default function VisitWithExtraMoM({
	accountId, labId, vendorId, from, to,
}: {
	accountId?: string | null;
	labId?: string | null;
	vendorId?: string | null;
	from: string;
	to: string;
}) {
	const [rows, setRows] = useState<ApiRow[]>([]);
	const [loading, setLoading] = useState(false);
	const [err, setErr] = useState<string | null>(null);

	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState('');
	const [detailRows, setDetailRows] = useState<DetailRow[]>([]);
	const [dErr, setDErr] = useState<string | null>(null);
	const [dLoading, setDLoading] = useState(false);

	type DSort =
		| 'apptAt'
		| 'labName'
		| 'tpaName'
		| 'insuranceNickName'
		| 'clientName'
		| 'clientRef'
		| 'status'
		| 'serviceType'
		| 'visitType'
		| 'extraChargeRs'
		| 'testAmountRs'
		| 'totalAmountRs';

	const [dSort, setDSort] = useState<DSort>('apptAt');
	const [dDir, setDDir] = useState<'asc' | 'desc'>('desc');

	const sorted = useMemo(() => {
		const arr = [...detailRows];
		arr.sort((a, b) => {
			const va =
				dSort === 'totalAmountRs'
					? detailTotal(a)
					: (a[dSort] ?? '') as any;

			const vb =
				dSort === 'totalAmountRs'
					? detailTotal(b)
					: (b[dSort] ?? '') as any;

			if (va === vb) return 0;
			const cmp = va > vb ? 1 : -1;
			return dDir === 'asc' ? cmp : -cmp;
		});
		return arr;
	}, [detailRows, dSort, dDir]);

	function toggleSort(k: DSort) {
		if (k === dSort) setDDir(dDir === 'asc' ? 'desc' : 'asc');
		else {
			setDSort(k);
			setDDir('asc');
		}
	}

	async function load() {
		setLoading(true);
		setErr(null);

		try {
			const data = await fetchJSON<ApiResp>('/api/reports/accounts/mom-visit-extra', {
				method: 'POST',
				body: JSON.stringify({ accountId, labId, vendorId, from, to }),
			});
			setRows(Array.isArray(data.rows) ? data.rows : []);
		} catch (e: any) {
			setErr(e?.message || 'Failed to load');
			setRows([]);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		load();
	}, [accountId, labId, vendorId, from, to]);

	async function openDetails(month: string, which: 'center' | 'localHome' | 'outerHome') {
		setOpen(true);

		const lbl =
			which === 'center'
				? 'Center Visit with Amount'
				: which === 'localHome'
					? 'Local Home Visit with Amount'
					: 'Outer Home Visit with Amount';

		setTitle(`${month} • ${lbl}`);
		setDErr(null);
		setDLoading(true);
		setDetailRows([]);

		try {
			const [y, m] = month.split('-').map(Number);
			const fromM = `${y}-${String(m).padStart(2, '0')}-01`;
			const last = new Date(y, m, 0);
			const toM = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;

			const serviceType =
				which === 'localHome' ? 'Local'
					: which === 'outerHome' ? 'Outer'
						: undefined;

			const visitType = which === 'center' ? 'CENTER' : 'HOME';

			const data = await fetchJSON<{ rows: DetailRow[] }>('/api/reports/accounts/details', {
				method: 'POST',
				body: JSON.stringify({
					from: fromM,
					to: toM,
					labId,
					vendorId,
					accountId,
					serviceType,
					visitType,
				}),
			});

			const onlyWithAmount = (data.rows || []).filter(r => {
				const travel = money(r.extraChargeRs);
				const test = money(r.testAmountRs);
				const total = detailTotal(r);
				return travel > 0 || test > 0 || total > 0;
			});

			setDetailRows(onlyWithAmount);
		} catch (e: any) {
			setDErr(e?.message || 'Failed to load details');
		} finally {
			setDLoading(false);
		}
	}

	function downloadCSV() {
		const headers = [
			{ key: 'apptAt', label: 'Appointment Date' },
			{ key: 'labName', label: 'Lab Name' },
			{ key: 'status', label: 'Status' },
			{ key: 'serviceType', label: 'Service Type' },
			{ key: 'visitType', label: 'Visit' },
			{ key: 'tpaName', label: 'TPA Name' },
			{ key: 'insuranceNickName', label: 'Insurance' },
			{ key: 'clientName', label: 'Client Name' },
			{ key: 'clientRef', label: 'Ref' },
			{ key: 'extraChargeRs', label: 'Travel Amount (₹)' },
			{ key: 'testAmountRs', label: 'Test Amount (₹)' },
			{ key: 'totalAmountRs', label: 'Total Amount (₹)' },
		] as const;

		const escape = (v: any) => {
			const s = v == null ? '' : String(v);
			return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
		};

		const head = headers.map(h => h.label).join(',');
		const lines = sorted.map(r =>
			headers.map(h => {
				let val: any = '';

				if (h.key === 'apptAt') {
					val = new Date(r.apptAt).toLocaleDateString();
				} else if (h.key === 'extraChargeRs') {
					val = r.extraChargeRs != null ? r.extraChargeRs : '';
				} else if (h.key === 'testAmountRs') {
					val = r.testAmountRs != null ? r.testAmountRs : '';
				} else if (h.key === 'totalAmountRs') {
					val = detailTotal(r);
				} else {
					val = (r as any)[h.key] ?? '';
				}

				return escape(val);
			}).join(',')
		);

		const csv = [head, ...lines].join('\r\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'appointments-visit-extra-details.csv';
		document.body.appendChild(a);
		a.click();
		setTimeout(() => {
			URL.revokeObjectURL(url);
			a.remove();
		}, 0);
	}

	const totals = useMemo(() => {
		return rows.reduce(
			(acc, r) => {
				acc.centerCount += money(r.centerWithExtra.count);
				acc.centerAmount += bucketTotal(r.centerWithExtra);

				acc.localCount += money(r.localHomeWithExtra.count);
				acc.localAmount += bucketTotal(r.localHomeWithExtra);

				acc.outerCount += money(r.outerHomeWithExtra.count);
				acc.outerAmount += bucketTotal(r.outerHomeWithExtra);

				return acc;
			},
			{
				centerCount: 0,
				centerAmount: 0,
				localCount: 0,
				localAmount: 0,
				outerCount: 0,
				outerAmount: 0,
			}
		);
	}, [rows]);

	const detailTotals = useMemo(() => {
		return sorted.reduce(
			(acc, r) => {
				acc.travel += money(r.extraChargeRs);
				acc.test += money(r.testAmountRs);
				acc.total += detailTotal(r);
				return acc;
			},
			{ travel: 0, test: 0, total: 0 }
		);
	}, [sorted]);

	return (
		<div className="rounded-xl border bg-white p-4 shadow-sm">
			<div className="flex items-center justify-between mb-2">
				<h3 className="text-base font-semibold">Visit Type × Service Type — With Amount (MoM)</h3>
			</div>

			{err && <div className="text-sm text-red-600 mb-2">{err}</div>}

			<div className="overflow-x-auto">
				<table className="min-w-[900px] text-sm">
					<thead className="bg-gray-50">
						<tr>
							<th className="px-3 py-2 text-left font-semibold">Month</th>
							<th className="px-3 py-2 text-right font-semibold">Center visit • Count</th>
							<th className="px-3 py-2 text-right font-semibold">Center visit • Amount</th>
							<th className="px-3 py-2 text-right font-semibold">Local + Home • Count</th>
							<th className="px-3 py-2 text-right font-semibold">Local + Home • Amount</th>
							<th className="px-3 py-2 text-right font-semibold">Outer + Home • Count</th>
							<th className="px-3 py-2 text-right font-semibold">Outer + Home • Amount</th>
						</tr>
					</thead>

					<tbody>
						{loading ? (
							<tr>
								<td colSpan={7} className="px-3 py-4 text-center text-gray-500">Loading…</td>
							</tr>
						) : rows.length === 0 ? (
							<tr>
								<td colSpan={7} className="px-3 py-4 text-center text-gray-500">No data</td>
							</tr>
						) : rows.map(r => (
							<tr key={r.month} className="border-t">
								<td className="px-3 py-2">{r.month}</td>

								<td
									className="px-3 py-2 text-right cursor-pointer hover:underline"
									onClick={() => openDetails(r.month, 'center')}
								>
									{money(r.centerWithExtra.count).toLocaleString()}
								</td>
								<td className="px-3 py-2 text-right">{currency(bucketTotal(r.centerWithExtra))}</td>

								<td
									className="px-3 py-2 text-right cursor-pointer hover:underline"
									onClick={() => openDetails(r.month, 'localHome')}
								>
									{money(r.localHomeWithExtra.count).toLocaleString()}
								</td>
								<td className="px-3 py-2 text-right">{currency(bucketTotal(r.localHomeWithExtra))}</td>

								<td
									className="px-3 py-2 text-right cursor-pointer hover:underline"
									onClick={() => openDetails(r.month, 'outerHome')}
								>
									{money(r.outerHomeWithExtra.count).toLocaleString()}
								</td>
								<td className="px-3 py-2 text-right">{currency(bucketTotal(r.outerHomeWithExtra))}</td>
							</tr>
						))}
					</tbody>

					{rows.length > 0 && (
						<tfoot className="bg-gray-50">
							<tr className="border-t">
								<td className="px-3 py-2 font-semibold">Total</td>
								<td className="px-3 py-2 text-right font-semibold">{totals.centerCount.toLocaleString()}</td>
								<td className="px-3 py-2 text-right font-semibold">{currency(totals.centerAmount)}</td>
								<td className="px-3 py-2 text-right font-semibold">{totals.localCount.toLocaleString()}</td>
								<td className="px-3 py-2 text-right font-semibold">{currency(totals.localAmount)}</td>
								<td className="px-3 py-2 text-right font-semibold">{totals.outerCount.toLocaleString()}</td>
								<td className="px-3 py-2 text-right font-semibold">{currency(totals.outerAmount)}</td>
							</tr>
						</tfoot>
					)}
				</table>
			</div>

			<div className="mt-2 text-xs text-gray-600 inline-flex items-center gap-2">
				<Info className="h-4 w-4" />
				Counts and amounts include appointments with positive Travel Amount, Test Amount, or Total Amount. Click a count to view the list for that month.
			</div>

			{open && (
				<div className="fixed inset-0 z-50">
					<div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
					<div className="absolute inset-0 flex items-center justify-center p-4">
						<div className="w-full max-w-7xl rounded-2xl bg-white shadow-xl border">
							<div className="flex items-center justify-between px-4 py-3 border-b">
								<div className="font-semibold">Appointments — {title}</div>
								<div className="flex items-center gap-2">
									<button
										className="inline-flex items-center gap-2 text-sm px-2.5 py-1.5 border rounded hover:bg-gray-50"
										onClick={downloadCSV}
									>
										<Download className="h-4 w-4" /> CSV
									</button>
									<button className="p-1 rounded hover:bg-gray-100" onClick={() => setOpen(false)} aria-label="Close">
										<X className="h-5 w-5" />
									</button>
								</div>
							</div>

							<div className="px-4 py-3">
								{dErr && <div className="mb-2 text-sm text-red-600">{dErr}</div>}
								{dLoading ? (
									<div className="text-sm text-gray-600">Loading…</div>
								) : (
									<div className="overflow-x-auto max-h-[60vh] border rounded">
										<table className="min-w-[1500px] text-sm">
											<thead className="bg-gray-50 sticky top-0 z-10">
												<tr>
													<th className="px-3 py-2">#</th>
													<SortTh k="apptAt" cur={dSort} dir={dDir} setK={toggleSort}>Appointment Date</SortTh>
													<SortTh k="labName" cur={dSort} dir={dDir} setK={toggleSort}>Lab Name</SortTh>
													<SortTh k="status" cur={dSort} dir={dDir} setK={toggleSort}>Status</SortTh>
													<SortTh k="serviceType" cur={dSort} dir={dDir} setK={toggleSort}>Service Type</SortTh>
													<SortTh k="visitType" cur={dSort} dir={dDir} setK={toggleSort}>Visit</SortTh>
													<SortTh k="tpaName" cur={dSort} dir={dDir} setK={toggleSort}>TPA Name</SortTh>
													<SortTh k="insuranceNickName" cur={dSort} dir={dDir} setK={toggleSort}>Insurance</SortTh>
													<SortTh k="clientName" cur={dSort} dir={dDir} setK={toggleSort}>Client Name</SortTh>
													<SortTh k="clientRef" cur={dSort} dir={dDir} setK={toggleSort}>Ref</SortTh>
													<SortTh k="extraChargeRs" cur={dSort} dir={dDir} setK={toggleSort} align="right">Travel Amount (₹)</SortTh>
													<SortTh k="testAmountRs" cur={dSort} dir={dDir} setK={toggleSort} align="right">Test Amount (₹)</SortTh>
													<SortTh k="totalAmountRs" cur={dSort} dir={dDir} setK={toggleSort} align="right">Total Amount (₹)</SortTh>
												</tr>
											</thead>

											<tbody>
												{sorted.length === 0 ? (
													<tr>
														<td className="px-3 py-4 text-center text-gray-500" colSpan={13}>No data</td>
													</tr>
												) : sorted.map((r, i) => (
													<tr key={r.id} className="border-t">
														<td className="px-3 py-2">{i + 1}</td>
														<td className="px-3 py-2 whitespace-nowrap">{new Date(r.apptAt).toLocaleDateString()}</td>
														<td className="px-3 py-2">{r.labName ?? ''}</td>
														<td className="px-3 py-2">{r.status ?? ''}</td>
														<td className="px-3 py-2">{r.serviceType ?? ''}</td>
														<td className="px-3 py-2">{r.visitType === 'HOME' ? 'Home' : r.visitType === 'CENTER' ? 'Center' : (r.visitType ?? '')}</td>
														<td className="px-3 py-2">{r.tpaName ?? ''}</td>
														<td className="px-3 py-2">{r.insuranceNickName ?? ''}</td>
														<td className="px-3 py-2">{r.clientName ?? ''}</td>
														<td className="px-3 py-2">{r.clientRef ?? ''}</td>
														<td className="px-3 py-2 text-right">{r.extraChargeRs != null ? `₹${money(r.extraChargeRs).toLocaleString()}` : ''}</td>
														<td className="px-3 py-2 text-right">{r.testAmountRs != null ? `₹${money(r.testAmountRs).toLocaleString()}` : ''}</td>
														<td className="px-3 py-2 text-right font-medium">{`₹${detailTotal(r).toLocaleString()}`}</td>
													</tr>
												))}
											</tbody>

											{sorted.length > 0 && (
												<tfoot className="bg-gray-50 sticky bottom-0">
													<tr className="border-t">
														<td colSpan={10} className="px-3 py-2 text-right font-semibold">Total</td>
														<td className="px-3 py-2 text-right font-semibold">{`₹${detailTotals.travel.toLocaleString()}`}</td>
														<td className="px-3 py-2 text-right font-semibold">{`₹${detailTotals.test.toLocaleString()}`}</td>
														<td className="px-3 py-2 text-right font-semibold">{`₹${detailTotals.total.toLocaleString()}`}</td>
													</tr>
												</tfoot>
											)}
										</table>
									</div>
								)}
							</div>

							<div className="px-4 py-3 border-t flex justify-end">
								<button className="rounded bg-brand text-white px-4 py-2" onClick={() => setOpen(false)}>Close</button>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function SortTh({
	k, cur, dir, setK, children, align = 'left',
}: {
	k: any;
	cur: any;
	dir: 'asc' | 'desc';
	setK: (k: any) => void;
	children: React.ReactNode;
	align?: 'left' | 'right';
}) {
	const active = cur === k;
	return (
		<th
			className={`px-3 py-2 text-${align} font-semibold cursor-pointer select-none whitespace-nowrap`}
			onClick={() => setK(k)}
			title="Sort"
		>
			<div className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end w-full' : ''}`}>
				<span>{children}</span>
				{active ? (dir === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : null}
			</div>
		</th>
	);
}