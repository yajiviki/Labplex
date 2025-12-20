'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Save, RefreshCw, Search, AlertTriangle, CheckCircle2 } from 'lucide-react';

type Staff = { id: string; name: string; userId: string; phone: string; role: string };
type Row = {
	id: string;
	apptAt: string | null;
	proposalNo: string;
	mobileNo: string;
	insuranceName: string;
	testSummary: string;
	location: string;
	status: string;
	addressRemark: string;
	assignedToId: string;
	assignedAt: string | null;
};

function formatDateTime(iso?: string | null) {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function badgeCls(status: string) {
	const s = (status || '').toLowerCase();
	if (s.includes('confirmed')) return 'bg-green-100 text-green-800';
	if (s.includes('need confirmation')) return 'bg-yellow-100 text-yellow-900';
	return 'bg-gray-100 text-gray-700';
}

export default function OuterAppointmentAssignPage() {
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);

	const [staff, setStaff] = useState<Staff[]>([]);
	const [rows, setRows] = useState<Row[]>([]);

	const [q, setQ] = useState('');
	const [msgOk, setMsgOk] = useState<string | null>(null);
	const [msgErr, setMsgErr] = useState<string | null>(null);

	// local edits
	const [assignedTo, setAssignedTo] = useState<Record<string, string>>({});
	const [remark, setRemark] = useState<Record<string, string>>({});

	async function load() {
		setLoading(true);
		setMsgOk(null);
		setMsgErr(null);

		try {
			const res = await fetch('/api/appointments/outer-assignments', { cache: 'no-store' });
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.error || 'Load failed');

			setStaff(Array.isArray(data.staff) ? data.staff : []);
			const list: Row[] = Array.isArray(data.rows) ? data.rows : [];
			setRows(list);

			// hydrate edits from server values
			const a: Record<string, string> = {};
			const r: Record<string, string> = {};
			for (const row of list) {
				a[row.id] = row.assignedToId || '';
				r[row.id] = row.addressRemark || '';
			}
			setAssignedTo(a);
			setRemark(r);
		} catch (e: any) {
			setMsgErr(e?.message || 'Network error');
			setStaff([]);
			setRows([]);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => { load(); }, []);

	const filtered = useMemo(() => {
		const term = q.trim().toLowerCase();
		if (!term) return rows;
		return rows.filter(r => {
			const hay = [
				r.proposalNo,
				r.mobileNo,
				r.insuranceName,
				r.testSummary,
				r.location,
				r.status,
			].filter(Boolean).map(x => String(x).toLowerCase());
			return hay.some(s => s.includes(term));
		});
	}, [rows, q]);

	const stats = useMemo(() => {
		const total = rows.length;
		let complete = 0;
		for (const r of rows) {
			const s = assignedTo[r.id] || '';
			const rm = (remark[r.id] || '').trim();
			if (s && rm) complete += 1;
		}
		return { total, complete, pending: total - complete };
	}, [rows, assignedTo, remark]);

	async function onSaveAll() {
		setMsgOk(null);
		setMsgErr(null);

		if (!rows.length) return;

		// Validate all rows (as per requirement: address remark must be entered)
		const invalid = rows.filter(r => !(assignedTo[r.id] || '').trim() || !(remark[r.id] || '').trim());
		if (invalid.length) {
			setMsgErr(`Please select Staff and enter Address Remark for all rows. Pending: ${invalid.length}`);
			return;
		}

		setSaving(true);
		try {
			const payload = {
				items: rows.map(r => ({
					id: r.id,
					assignedToId: assignedTo[r.id],
					addressRemark: (remark[r.id] || '').trim(),
				})),
			};

			const res = await fetch('/api/appointments/outer-assignments', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.error || 'Save failed');

			setMsgOk('Assignments saved successfully.');
			await load();
		} catch (e: any) {
			setMsgErr(e?.message || 'Network error');
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="mx-auto w-full max-w-[1600px] px-4 space-y-6">
			{/* Header */}
			<div className="rounded-xl border bg-white px-5 py-4 shadow-sm flex items-center justify-between gap-3">
				<div className="flex items-center gap-3">
					<div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand-600">
						<CalendarPlus className="h-5 w-5" />
					</div>
					<div>
						<h1 className="text-2xl md:text-3xl font-bold tracking-tight">Outer Appointment Assignment</h1>
						<p className="text-sm text-gray-600 mt-1">
							Upcoming appointments with status <b>Need Confirmation</b> / <b>Confirmed</b> only.
						</p>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={load}
						className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-gray-50"
						disabled={loading || saving}
						title="Refresh"
					>
						<RefreshCw className="h-4 w-4" />
						Refresh
					</button>

					<button
						type="button"
						onClick={onSaveAll}
						className="inline-flex items-center gap-2 rounded bg-brand text-white px-4 py-2 text-sm disabled:opacity-60"
						disabled={loading || saving || rows.length === 0}
						title="Save all assignments"
					>
						<Save className="h-4 w-4" />
						{saving ? 'Saving…' : 'Save All'}
					</button>
				</div>
			</div>

			{/* Alerts */}
			{msgErr && (
				<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex items-start gap-2">
					<AlertTriangle className="h-4 w-4 mt-0.5" />
					<span>{msgErr}</span>
				</div>
			)}
			{msgOk && (
				<div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 flex items-start gap-2">
					<CheckCircle2 className="h-4 w-4 mt-0.5" />
					<span>{msgOk}</span>
				</div>
			)}

			{/* Toolbar */}
			<div className="rounded-xl border bg-white p-4 shadow-sm">
				<div className="flex flex-wrap items-end justify-between gap-3">
					<div>
						<label className="block text-xs text-gray-600 mb-1">Search</label>
						<div className="relative">
							<Search className="h-4 w-4 absolute left-3 top-2.5 text-gray-400" />
							<input
								className="pl-9 pr-3 py-2 border rounded w-[360px] max-w-full"
								placeholder="Proposal, Mobile, Insurance, Test, Location…"
								value={q}
								onChange={(e) => setQ(e.target.value)}
							/>
						</div>
					</div>

					<div className="text-sm text-gray-700">
						<div className="flex items-center gap-3">
							<span><b>Total:</b> {stats.total}</span>
							<span><b>Completed:</b> {stats.complete}</span>
							<span className={stats.pending ? 'text-red-600' : 'text-green-700'}>
								<b>Pending:</b> {stats.pending}
							</span>
						</div>
					</div>
				</div>

				{/* Table */}
				<div className="mt-4 w-full overflow-x-auto">
					<div className="max-h-[620px] overflow-y-auto rounded border">
						<table className="w-full min-w-[1250px]">
							<thead className="sticky top-0 z-10 bg-white border-b">
								<tr className="text-left">
									<th className="px-3 py-2 text-sm font-semibold text-gray-700 whitespace-nowrap">Appointment Date</th>
									<th className="px-3 py-2 text-sm font-semibold text-gray-700 whitespace-nowrap">Proposal No</th>
									<th className="px-3 py-2 text-sm font-semibold text-gray-700 whitespace-nowrap">Mobile No</th>
									<th className="px-3 py-2 text-sm font-semibold text-gray-700 whitespace-nowrap">Insurance</th>
									<th className="px-3 py-2 text-sm font-semibold text-gray-700 whitespace-nowrap">Test</th>
									<th className="px-3 py-2 text-sm font-semibold text-gray-700 whitespace-nowrap">Location</th>
									<th className="px-3 py-2 text-sm font-semibold text-gray-700 whitespace-nowrap">Status</th>
									<th className="px-3 py-2 text-sm font-semibold text-gray-700 whitespace-nowrap">Assigned Staff</th>
									<th className="px-3 py-2 text-sm font-semibold text-gray-700 whitespace-nowrap">Address Remark</th>
								</tr>
							</thead>

							<tbody>
								{loading ? (
									<tr>
										<td colSpan={9} className="px-3 py-6 text-center text-sm text-gray-500">Loading…</td>
									</tr>
								) : filtered.length === 0 ? (
									<tr>
										<td colSpan={9} className="px-3 py-6 text-center text-sm text-gray-500">
											No upcoming Outer appointments found for Need Confirmation / Confirmed.
										</td>
									</tr>
								) : filtered.map((r) => {
									const staffVal = assignedTo[r.id] || '';
									const remarkVal = remark[r.id] || '';

									const rowIncomplete = !staffVal || !remarkVal.trim();

									return (
										<tr key={r.id} className={`border-t hover:bg-gray-50 ${rowIncomplete ? 'bg-yellow-50/40' : ''}`}>
											<td className="px-3 py-2 text-sm whitespace-nowrap">{formatDateTime(r.apptAt)}</td>
											<td className="px-3 py-2 text-sm whitespace-nowrap">{r.proposalNo}</td>
											<td className="px-3 py-2 text-sm whitespace-nowrap">{r.mobileNo}</td>
											<td className="px-3 py-2 text-sm">{r.insuranceName}</td>
											<td className="px-3 py-2 text-sm whitespace-nowrap">{r.testSummary}</td>
											<td className="px-3 py-2 text-sm">{r.location}</td>
											<td className="px-3 py-2 text-sm whitespace-nowrap">
												<span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${badgeCls(r.status)}`}>
													{r.status}
												</span>
											</td>

											<td className="px-3 py-2 text-sm">
												<select
													className="w-[240px] max-w-full border rounded px-2 py-1.5 bg-white"
													value={staffVal}
													onChange={(e) => setAssignedTo(prev => ({ ...prev, [r.id]: e.target.value }))}
												>
													<option value="">Select staff</option>
													{staff.map(s => (
														<option key={s.id} value={s.id}>
															{s.name} ({s.userId})
														</option>
													))}
												</select>
											</td>

											<td className="px-3 py-2 text-sm">
												<input
													className="w-[420px] max-w-full border rounded px-3 py-1.5"
													placeholder="Enter address remark (required)"
													value={remarkVal}
													onChange={(e) => setRemark(prev => ({ ...prev, [r.id]: e.target.value }))}
												/>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>

					<div className="mt-2 text-xs text-gray-600">
						Rows highlighted in light yellow are pending Staff selection or Address Remark.
					</div>
				</div>
			</div>
		</div>
	);
}
