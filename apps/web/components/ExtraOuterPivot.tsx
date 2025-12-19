// components/ExtraOuterPivot.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Info, X } from 'lucide-react';

type PivotResp = {
	current: { month: string; outerCount: number; extraAmount: number };
	previous: { month: string; outerCount: number; extraAmount: number };
	currentIds: string[];
	previousIds: string[];
};

type DetailRow = {
	id: string;
	apptAt: string;
	labName: string;
	status: string;
	tpaName: string;
	insurance: string;
	clientName: string;
	ref: string;
	extraAmount: number;
};

export default function ExtraOuterPivot({
	insuranceCompanyId,
	labId,
	vendorId,
}: {
	insuranceCompanyId?: string | null;
	labId?: string | null;
	vendorId?: string | null;
}) {
	const [loading, setLoading] = useState(false);
	const [data, setData] = useState<PivotResp | null>(null);
	const [err, setErr] = useState<string | null>(null);

	// dialog state
	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState('');
	const [detailLoading, setDetailLoading] = useState(false);
	const [rows, setRows] = useState<DetailRow[]>([]);
	const [q, setQ] = useState('');

	async function load() {
		setLoading(true); setErr(null);
		try {
			const res = await fetch('/api/accounts/extra-pivot', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ insuranceCompanyId, labId, vendorId }),
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json?.error || 'Load failed');
			setData(json);
		} catch (e: any) {
			setErr(e?.message || 'Network error');
			setData(null);
		} finally {
			setLoading(false);
		}
	}
	useEffect(() => { load(); /* eslint-disable-next-line */ }, [insuranceCompanyId, labId, vendorId]);

	async function openDetails(kind: 'current' | 'previous', metric: 'outer' | 'extra') {
		if (!data) return;
		const ids = kind === 'current' ? data.currentIds : data.previousIds;
		if (!ids.length) return;

		setTitle(`${kind === 'current' ? data.current.month : data.previous.month} • ${metric === 'outer' ? 'Outer cases' : 'Extra Amount'}`);
		setOpen(true);
		setDetailLoading(true);
		setRows([]);
		setQ('');

		try {
			const res = await fetch('/api/accounts/extra-details', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ids }),
			});
			const json = await res.json();
			if (!res.ok) throw new Error(json?.error || 'Load details failed');
			setRows(Array.isArray(json.items) ? json.items : []);
		} catch (e: any) {
			setRows([]);
		} finally {
			setDetailLoading(false);
		}
	}

	const filtered = useMemo(() => {
		const t = q.trim().toLowerCase();
		if (!t) return rows;
		return rows.filter(r =>
			[r.apptAt, r.labName, r.status, r.tpaName, r.insurance, r.clientName, r.ref, String(r.extraAmount)]
				.some(v => String(v ?? '').toLowerCase().includes(t))
		);
	}, [rows, q]);

	return (
		<div className="rounded-xl border bg-white p-4 shadow-sm mb-4">
			<div className="flex items-center justify-between mb-2">
				<h3 className="text-base font-semibold">Outer Cases vs Extra Amount (MoM)</h3>
				{loading && <div className="text-xs text-gray-500">Loading…</div>}
			</div>
			{err && <div className="text-sm text-red-600 mb-2">{err}</div>}

			<div className="overflow-x-auto">
				<table className="min-w-[560px] w-full text-sm border rounded">
					<thead className="bg-gray-50">
						<tr>
							<th className="px-3 py-2 text-left">Month</th>
							<th className="px-3 py-2 text-right">Outer cases</th>
							<th className="px-3 py-2 text-right">Extra Amount (₹)</th>
						</tr>
					</thead>
					<tbody>
						{data ? (
							<>
								<tr className="border-t hover:bg-gray-50">
									<td className="px-3 py-2">{data.current.month}</td>
									<td className="px-3 py-2 text-right">
										<button
											className="underline underline-offset-2"
											onClick={() => openDetails('current', 'outer')}
											title="View records"
										>
											{data.current.outerCount}
										</button>
									</td>
									<td className="px-3 py-2 text-right">
										<button
											className="underline underline-offset-2"
											onClick={() => openDetails('current', 'extra')}
											title="View records"
										>
											{data.current.extraAmount.toLocaleString('en-IN')}
										</button>
									</td>
								</tr>
								<tr className="border-t hover:bg-gray-50">
									<td className="px-3 py-2">{data.previous.month}</td>
									<td className="px-3 py-2 text-right">
										<button
											className="underline underline-offset-2"
											onClick={() => openDetails('previous', 'outer')}
											title="View records"
										>
											{data.previous.outerCount}
										</button>
									</td>
									<td className="px-3 py-2 text-right">
										<button
											className="underline underline-offset-2"
											onClick={() => openDetails('previous', 'extra')}
											title="View records"
										>
											{data.previous.extraAmount.toLocaleString('en-IN')}
										</button>
									</td>
								</tr>
							</>
						) : (
							<tr><td colSpan={3} className="px-3 py-3 text-center text-gray-500">No data</td></tr>
						)}
					</tbody>
				</table>
			</div>

			{/* Tip row */}
			<div className="mt-2 text-xs text-gray-600 inline-flex items-center gap-2">
				<Info className="h-4 w-4" />
				<span>Outer cases counted where Service Type is “Outer”. Click a number to see the records.</span>
			</div>

			{/* Dialog */}
			{open && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
					<div className="bg-white rounded-xl shadow-lg w-full max-w-6xl">
						<div className="flex items-center justify-between p-3 border-b bg-blue-100">
							<h4 className="font-semibold">{title}</h4>
							<button className="p-1 rounded hover:bg-gray-100" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
						</div>

						<div className="p-3">
							<div className="flex items-center gap-3 mb-3">
								<input
									placeholder="Search…"
									className="border rounded px-3 py-2 w-72"
									value={q}
									onChange={(e) => setQ(e.target.value)}
								/>
								<div className="ml-auto text-sm text-gray-600">
									{detailLoading ? 'Loading…' : `${filtered.length} result(s)`}
								</div>
							</div>

							<div className="overflow-x-auto border rounded max-h-[420px] overflow-y-auto">
								<table className="min-w-full text-sm">
									<thead className="bg-gray-50">
										<tr>
											<th className="px-3 py-2 text-left">Appointment Date</th>
											<th className="px-3 py-2 text-left">Lab Name</th>
											<th className="px-3 py-2 text-left">Status</th>
											<th className="px-3 py-2 text-left">TPA Name</th>
											<th className="px-3 py-2 text-left">Insurance</th>
											<th className="px-3 py-2 text-left">Client Name</th>
											<th className="px-3 py-2 text-left">Ref</th>
											<th className="px-3 py-2 text-right">Extra Amount</th>
										</tr>
									</thead>
									<tbody>
										{detailLoading ? (
											<tr><td colSpan={8} className="px-3 py-6 text-center text-gray-500">Loading…</td></tr>
										) : filtered.length === 0 ? (
											<tr><td colSpan={8} className="px-3 py-6 text-center text-gray-500">No data</td></tr>
										) : (
											filtered.map(r => (
												<tr key={r.id} className="border-t hover:bg-gray-50">
													<td className="px-3 py-2 whitespace-nowrap">{r.apptAt}</td>
													<td className="px-3 py-2">{r.labName}</td>
													<td className="px-3 py-2">{r.status}</td>
													<td className="px-3 py-2">{r.tpaName}</td>
													<td className="px-3 py-2">{r.insurance}</td>
													<td className="px-3 py-2">{r.clientName}</td>
													<td className="px-3 py-2">{r.ref}</td>
													<td className="px-3 py-2 text-right">{r.extraAmount.toLocaleString('en-IN')}</td>
												</tr>
											))
										)}
									</tbody>
								</table>
							</div>
						</div>

						<div className="p-3 border-t text-right">
							<button className="rounded border px-3 py-1.5" onClick={() => setOpen(false)}>Close</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
