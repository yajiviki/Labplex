'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Download, Info, X } from 'lucide-react';

type ApiRow = {
	month: string;
	centerWithExtra: { count: number; amount: number };
	localHomeWithExtra: { count: number; amount: number };
	outerHomeWithExtra: { count: number; amount: number };
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

	// details modal
	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState('');
	const [detailRows, setDetailRows] = useState<DetailRow[]>([]);
	const [dErr, setDErr] = useState<string | null>(null);
	const [dLoading, setDLoading] = useState(false);
	type DSort = 'apptAt' | 'labName' | 'tpaName' | 'insuranceNickName' | 'clientName' | 'clientRef' | 'status' | 'serviceType' | 'visitType' | 'extraChargeRs';
	const [dSort, setDSort] = useState<DSort>('apptAt');
	const [dDir, setDDir] = useState<'asc' | 'desc'>('desc');

	const sorted = useMemo(() => {
		const arr = [...detailRows];
		arr.sort((a, b) => {
			const va = (a[dSort] ?? '') as any;
			const vb = (b[dSort] ?? '') as any;
			if (va === vb) return 0;
			const cmp = va > vb ? 1 : -1;
			return dDir === 'asc' ? cmp : -cmp;
		});
		return arr;
	}, [detailRows, dSort, dDir]);

	function toggleSort(k: DSort) {
		if (k === dSort) setDDir(dDir === 'asc' ? 'desc' : 'asc');
		else { setDSort(k); setDDir('asc'); }
	}

	async function load() {
		setLoading(true); setErr(null);
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
	useEffect(() => { load(); }, [accountId, labId, vendorId, from, to]);

	// Map click to detail filters
	async function openDetails(month: string, which: 'center' | 'localHome' | 'outerHome') {
		setOpen(true);
		const lbl = which === 'center' ? 'Center Visit with Extra'
			: which === 'localHome' ? 'Local Home Visit with Extra'
				: 'Outer Home Visit with Extra';
		setTitle(`${month} • ${lbl}`);
		setDErr(null); setDLoading(true); setDetailRows([]);

		try {
			// Month → month range
			const [y, m] = month.split('-').map(Number);
			const fromM = `${y}-${String(m).padStart(2, '0')}-01`;
			const last = new Date(y, m, 0);
			const toM = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;

			// Build filters for the detail API.
			const serviceType =
				which === 'localHome' ? 'Local' :
					which === 'outerHome' ? 'Outer' :
						undefined; // center may be Local/Outer/Other

			const visitType = which === 'center' ? 'CENTER' : 'HOME';

			// Use your existing details route, then client-filter to extra>0 (safe even if API doesn’t support extraOnly).
			const data = await fetchJSON<{ rows: DetailRow[] }>('/api/reports/accounts/details', {
				method: 'POST',
				body: JSON.stringify({
					from: fromM,
					to: toM,
					labId, vendorId, accountId,
					serviceType, visitType,
				}),
			});

			const onlyWithExtra = (data.rows || []).filter(r => (r.extraChargeRs ?? 0) > 0);
			setDetailRows(onlyWithExtra);
		} catch (e: any) {
			setDErr(e?.message || 'Failed to load details');
		} finally {
			setDLoading(false);
		}
	}

	function currency(n: number) {
		return `₹${Number(n || 0).toLocaleString()}`;
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
			{ key: 'extraChargeRs', label: 'Extra Amount (₹)' },
		] as const;

		const escape = (v: any) => {
			const s = v == null ? '' : String(v);
			return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
		};

		const head = headers.map(h => h.label).join(',');
		const lines = sorted.map(r => headers.map(h => {
			const val =
				h.key === 'apptAt' ? new Date(r.apptAt).toLocaleDateString() :
					h.key === 'extraChargeRs' ? (r.extraChargeRs != null ? r.extraChargeRs : '') :
						(r as any)[h.key] ?? '';
			return escape(val);
		}).join(','));

		const csv = [head, ...lines].join('\r\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url; a.download = 'appointments-visit-extra-details.csv';
		document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
	}

	return (
		<div className="rounded-xl border bg-white p-4 shadow-sm">
			<div className="flex items-center justify-between mb-2">
				<h3 className="text-base font-semibold">Visit Type × Service Type — With Extra Amount (MoM)</h3>
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
							<tr><td colSpan={7} className="px-3 py-4 text-center text-gray-500">Loading…</td></tr>
						) : rows.length === 0 ? (
							<tr><td colSpan={7} className="px-3 py-4 text-center text-gray-500">No data</td></tr>
						) : rows.map(r => (
							<tr key={r.month} className="border-t">
								<td className="px-3 py-2">{r.month}</td>

								{/* Center visit with Extra */}
								<td className="px-3 py-2 text-right cursor-pointer hover:underline"
									onClick={() => openDetails(r.month, 'center')}>
									{r.centerWithExtra.count.toLocaleString()}
								</td>
								<td className="px-3 py-2 text-right">{currency(r.centerWithExtra.amount)}</td>

								{/* Local + Home with Extra */}
								<td className="px-3 py-2 text-right cursor-pointer hover:underline"
									onClick={() => openDetails(r.month, 'localHome')}>
									{r.localHomeWithExtra.count.toLocaleString()}
								</td>
								<td className="px-3 py-2 text-right">{currency(r.localHomeWithExtra.amount)}</td>

								{/* Outer + Home with Extra */}
								<td className="px-3 py-2 text-right cursor-pointer hover:underline"
									onClick={() => openDetails(r.month, 'outerHome')}>
									{r.outerHomeWithExtra.count.toLocaleString()}
								</td>
								<td className="px-3 py-2 text-right">{currency(r.outerHomeWithExtra.amount)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className="mt-2 text-xs text-gray-600 inline-flex items-center gap-2">
				<Info className="h-4 w-4" />
				Counts/amounts include only appointments with a positive Extra Amount.
				Click a count to view the list for that month.
			</div>

			{/* Details modal */}
			{open && (
				<div className="fixed inset-0 z-50">
					<div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
					<div className="absolute inset-0 flex items-center justify-center p-4">
						<div className="w-full max-w-6xl rounded-2xl bg-white shadow-xl border">
							<div className="flex items-center justify-between px-4 py-3 border-b">
								<div className="font-semibold">Appointments — {title}</div>
								<div className="flex items-center gap-2">
									<button className="inline-flex items-center gap-2 text-sm px-2.5 py-1.5 border rounded hover:bg-gray-50" onClick={downloadCSV}>
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
										<table className="min-w-[1200px] text-sm">
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
													<SortTh k="extraChargeRs" cur={dSort} dir={dDir} setK={toggleSort} align="right">Extra Amount (₹)</SortTh>
												</tr>
											</thead>
											<tbody>
												{sorted.length === 0 ? (
													<tr><td className="px-3 py-4 text-center text-gray-500" colSpan={11}>No data</td></tr>
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
														<td className="px-3 py-2 text-right">{r.extraChargeRs != null ? `₹${Number(r.extraChargeRs).toLocaleString()}` : ''}</td>
													</tr>
												))}
											</tbody>
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
	k: any; cur: any; dir: 'asc' | 'desc'; setK: (k: any) => void;
	children: React.ReactNode; align?: 'left' | 'right';
}) {
	const active = cur === k;
	return (
		<th
			className={`px-3 py-2 text-${align} font-semibold cursor-pointer select-none`}
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
