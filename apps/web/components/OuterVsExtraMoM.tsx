'use client';

import { useEffect, useMemo, useState } from 'react';
import { Info, X, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { fetchJSON } from '../utils/fetchJSON';


type MoMRow = { month: string; outerCases: number; extraAmount: number };
type MoMResp = { rows: MoMRow[] };

type DetailRow = {
	id: string;
	apptAt: string;
	labName: string | null;
	tpaName: string | null;
	insuranceNickName: string | null;
	clientName: string | null;
	clientRef: string | null;
	status: string | null;
	extraChargeRs: number | null;
};

export default function OuterVsExtraMoM({
	accountId, labId, vendorId, from, to,
}: {
	accountId?: string | null;
	labId?: string | null;
	vendorId?: string | null;
	from: string;  // yyyy-mm-dd
	to: string;    // yyyy-mm-dd
}) {
	const [rows, setRows] = useState<MoMRow[]>([]);
	const [err, setErr] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	// details modal
	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState('');
	const [detailRows, setDetailRows] = useState<DetailRow[]>([]);
	const [dErr, setDErr] = useState<string | null>(null);
	const [dLoading, setDLoading] = useState(false);
	type DSort = 'apptAt' | 'labName' | 'tpaName' | 'insuranceNickName' | 'clientName' | 'clientRef' | 'status' | 'extraChargeRs';
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
			const data = await fetchJSON<MoMResp>('/api/reports/accounts/mom', {
				method: 'POST',
				body: JSON.stringify({ accountId, labId, vendorId, from, to }),
			});
			setRows(Array.isArray(data.rows) ? data.rows : []);
		} catch (e: any) {
			setErr(e?.message || 'Failed to load');
			setRows([]);
		} finally { setLoading(false); }
	}

	useEffect(() => { load(); }, [accountId, labId, vendorId, from, to]);

	async function openDetails(month: string, which: 'outer' | 'extra') {
		setOpen(true);
		setTitle(which === 'outer' ? `${month} • Outer cases` : `${month} • Extra Amount`);
		setDErr(null); setDLoading(true); setDetailRows([]);
		try {
			// month → from/to for that month
			const [y, m] = month.split('-').map(Number);
			const mFrom = `${y}-${String(m).padStart(2, '0')}-01`;
			const mTo = new Date(y, m, 0); // last day
			const req = {
				from: mFrom,
				to: `${mTo.getFullYear()}-${String(mTo.getMonth() + 1).padStart(2, '0')}-${String(mTo.getDate()).padStart(2, '0')}`,
				labId, vendorId, accountId,
				// filter logic per click
				serviceType: which === 'outer' ? 'Outer' : undefined,
			};

			// Reuse your existing details route:
			const data = await fetchJSON<{ rows: DetailRow[] }>('/api/reports/accounts/details', {
				method: 'POST',
				body: JSON.stringify(req),
			});
			setDetailRows(Array.isArray(data.rows) ? data.rows : []);
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
			{ key: 'tpaName', label: 'TPA Name' },
			{ key: 'insuranceNickName', label: 'Insurance' },
			{ key: 'clientName', label: 'Client Name' },
			{ key: 'clientRef', label: 'Ref' },
			{ key: 'extraChargeRs', label: 'Extra Amount (₹)' },
		] as const;

		const escape = (v: any) => {
			const s = v == null ? '' : String(v);
			const needs = /[",\r\n]/.test(s);
			return needs ? `"${s.replace(/"/g, '""')}"` : s;
		};

		const head = headers.map(h => h.label).join(',');
		const lines = sorted.map(r => headers.map(h => {
			const val = h.key === 'apptAt' ? new Date(r.apptAt).toLocaleDateString() :
				h.key === 'extraChargeRs' ? (r.extraChargeRs != null ? r.extraChargeRs : '') :
					(r as any)[h.key] ?? '';
			return escape(val);
		}).join(','));

		const csv = [head, ...lines].join('\r\n');
		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url; a.download = 'appointments-details.csv'; document.body.appendChild(a);
		a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
	}

	return (
		<div className="rounded-xl border bg-white p-4 shadow-sm">
			<div className="flex items-center justify-between mb-2">
				<h3 className="text-base font-semibold">Outer Cases vs Extra Amount (MoM)</h3>
			</div>

			{err && <div className="text-sm text-red-600 mb-2">{err}</div>}

			<div className="overflow-x-auto">
				<table className="min-w-[720px] text-sm">
					<thead className="bg-gray-50">
						<tr>
							<th className="px-3 py-2 text-left font-semibold">Month</th>
							<th className="px-3 py-2 text-right font-semibold">Outer cases</th>
							<th className="px-3 py-2 text-right font-semibold">Extra Amount (₹)</th>
						</tr>
					</thead>
					<tbody>
						{loading ? (
							<tr><td colSpan={3} className="px-3 py-4 text-center text-gray-500">Loading…</td></tr>
						) : rows.length === 0 ? (
							<tr><td colSpan={3} className="px-3 py-4 text-center text-gray-500">No data</td></tr>
						) : rows.map(r => (
							<tr key={r.month} className="border-t">
								<td className="px-3 py-2">{r.month}</td>
								<td
									className="px-3 py-2 text-right cursor-pointer hover:underline"
									onClick={() => openDetails(r.month, 'outer')}
									title="View Outer cases for this month"
								>
									{r.outerCases.toLocaleString()}
								</td>
								<td
									className="px-3 py-2 text-right cursor-pointer hover:underline"
									onClick={() => openDetails(r.month, 'extra')}
									title="View Extra Amount appointments for this month"
								>
									₹{r.extraAmount.toLocaleString()}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className="mt-2 text-xs text-gray-600 inline-flex items-center gap-2">
				<Info className="h-4 w-4" />
				Outer cases counted where Service Type is “Outer”. Click a number to view records.
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
										<table className="min-w-[1100px] text-sm">
											<thead className="bg-gray-50 sticky top-0 z-10">
												<tr>
													<th className="px-3 py-2 text-left font-semibold">#</th>
													<SortTh k="apptAt" cur={dSort} dir={dDir} setK={toggleSort}>Appointment Date</SortTh>
													<SortTh k="labName" cur={dSort} dir={dDir} setK={toggleSort}>Lab Name</SortTh>
													<SortTh k="status" cur={dSort} dir={dDir} setK={toggleSort}>Status</SortTh>
													<SortTh k="tpaName" cur={dSort} dir={dDir} setK={toggleSort}>TPA Name</SortTh>
													<SortTh k="insuranceNickName" cur={dSort} dir={dDir} setK={toggleSort}>Insurance</SortTh>
													<SortTh k="clientName" cur={dSort} dir={dDir} setK={toggleSort}>Client Name</SortTh>
													<SortTh k="clientRef" cur={dSort} dir={dDir} setK={toggleSort}>Ref</SortTh>
													<SortTh k="extraChargeRs" cur={dSort} dir={dDir} setK={toggleSort} align="right">Extra Amount (₹)</SortTh>
												</tr>
											</thead>
											<tbody>
												{sorted.length === 0 ? (
													<tr><td className="px-3 py-4 text-center text-gray-500" colSpan={9}>No data</td></tr>
												) : sorted.map((r, i) => (
													<tr key={r.id} className="border-t">
														<td className="px-3 py-2">{i + 1}</td>
														<td className="px-3 py-2 whitespace-nowrap">{new Date(r.apptAt).toLocaleDateString()}</td>
														<td className="px-3 py-2">{r.labName ?? ''}</td>
														<td className="px-3 py-2">{r.status ?? ''}</td>
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
	k: any; cur: any; dir: 'asc' | 'desc';
	setK: (k: any) => void; children: React.ReactNode; align?: 'left' | 'right';
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
