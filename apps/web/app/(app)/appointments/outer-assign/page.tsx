'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toPng } from 'html-to-image';
import { CalendarDays, Download, RefreshCcw, Save, AlertTriangle, Users } from 'lucide-react';

type Lab = {
	id: string;
	name: string;
	nickName?: string | null;
	labCode?: string | null;
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

type AssignmentRow = {
	id: string;

	labId: string;
	labNick?: string;
	labName?: string;
	labCode?: string;

	apptAt: string | null;

	clientName: string; // ✅ replaced proposalNo
	mobileNo: string;
	insuranceName: string;
	testSummary: string;
	location: string;
	status: string;

	addressRemark: string;
	assignedToId: string;
	assignedAt: string | null;
};

type ApiResp = {
	mode: 'ALL_LABS' | 'SINGLE_LAB';
	labId: string | null;
	users: UserRow[];
	rows: AssignmentRow[];
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

function userLabel(u: UserRow) {
	const uid = u.userId ? ` (${u.userId})` : '';
	return `${u.name}${uid}`;
}

export default function OuterAssignmentsPage() {
	const exportRef = useRef<HTMLDivElement | null>(null);

	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [exporting, setExporting] = useState(false);

	const [labs, setLabs] = useState<Lab[]>([]);
	const [labId, setLabId] = useState<string>(''); // '' = All Labs (SUPER_ADMIN)
	const [rows, setRows] = useState<AssignmentRow[]>([]);
	const [users, setUsers] = useState<UserRow[]>([]);

	const [err, setErr] = useState<string | null>(null);
	const [ok, setOk] = useState<string | null>(null);

	// Editable drafts (per row)
	const [draftAssignedTo, setDraftAssignedTo] = useState<Record<string, string>>({});
	const [draftRemark, setDraftRemark] = useState<Record<string, string>>({});

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

	async function loadAssignments(targetLabId?: string) {
		setLoading(true);
		setErr(null);
		setOk(null);

		try {
			const q = targetLabId ? `?labId=${encodeURIComponent(targetLabId)}` : '';
			const res = await fetch(`/api/appointments/outer-assignments${q}`, { cache: 'no-store' });
			const data = (await res.json().catch(() => null)) as ApiResp | null;

			if (!res.ok) {
				setErr((data as any)?.error || 'Load failed');
				setRows([]);
				setUsers([]);
				return;
			}
			if (!data) {
				setErr('Load failed');
				setRows([]);
				setUsers([]);
				return;
			}

			setRows(Array.isArray(data.rows) ? data.rows : []);

			// ✅ Only USER role (hide SUPER_ADMIN/ADMIN/STAFF)
			const all = Array.isArray(data.users) ? data.users : [];
			const onlyUser = all.filter(u => (u.role || '').toUpperCase() === 'USER');
			setUsers(onlyUser);

			// init drafts from server values
			const a: Record<string, string> = {};
			const r: Record<string, string> = {};
			for (const row of data.rows || []) {
				a[row.id] = row.assignedToId || '';
				r[row.id] = row.addressRemark || '';
			}
			setDraftAssignedTo(a);
			setDraftRemark(r);
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
		loadAssignments(''); // All labs by default (SUPER_ADMIN); others auto-scope
	}, []);

	useEffect(() => {
		loadAssignments(labId);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [labId]);

	const userMap = useMemo(() => {
		const m = new Map<string, UserRow>();
		for (const u of users) m.set(u.id, u);
		return m;
	}, [users]);

	const stats = useMemo(() => {
		const total = rows.length;
		const assigned = rows.filter(r => (draftAssignedTo[r.id] || r.assignedToId || '').trim()).length;
		const missingRemark = rows.filter(r => !(draftRemark[r.id] ?? r.addressRemark ?? '').trim()).length;
		return { total, assigned, missingRemark };
	}, [rows, draftAssignedTo, draftRemark]);

	// group rows by assignee (draft first, fallback to saved)
	const groupedForExport = useMemo(() => {
		const groups = new Map<string, AssignmentRow[]>();

		for (const r of rows) {
			const staffId = (draftAssignedTo[r.id] || r.assignedToId || '').trim();
			const key = staffId || '__UNASSIGNED__';
			const arr = groups.get(key) ?? [];
			arr.push(r);
			groups.set(key, arr);
		}

		// sort groups: assigned users alphabetically, unassigned at end
		const entries = Array.from(groups.entries()).map(([staffId, list]) => {
			const staffName =
				staffId === '__UNASSIGNED__'
					? 'Unassigned'
					: (userMap.get(staffId)?.name || 'Unknown User');
			return { staffId, staffName, list: list.sort((a, b) => String(a.apptAt).localeCompare(String(b.apptAt))) };
		});

		entries.sort((a, b) => {
			if (a.staffId === '__UNASSIGNED__') return 1;
			if (b.staffId === '__UNASSIGNED__') return -1;
			return a.staffName.localeCompare(b.staffName);
		});

		return entries;
	}, [rows, draftAssignedTo, userMap]);

	async function saveAll() {
		setErr(null);
		setOk(null);

		if (!rows.length) return;

		// validate
		for (const r of rows) {
			const staffId = (draftAssignedTo[r.id] || '').trim();
			const remark = (draftRemark[r.id] || '').trim();
			if (!staffId) {
				setErr('Please select Staff for all rows.');
				return;
			}
			if (!remark) {
				setErr('Please enter Address Remark for all rows.');
				return;
			}
		}

		setSaving(true);
		try {
			const items = rows.map(r => ({
				id: r.id,
				assignedToId: (draftAssignedTo[r.id] || '').trim(),
				addressRemark: (draftRemark[r.id] || '').trim(),
			}));

			const payload: any = { items };
			if (labId) payload.labId = labId;

			const res = await fetch('/api/appointments/outer-assignments', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				setErr(data?.error || 'Save failed');
				return;
			}

			setOk('Assignments saved');
			await loadAssignments(labId);
		} catch (e: any) {
			setErr(e?.message || 'Network error');
		} finally {
			setSaving(false);
		}
	}

	async function exportPngTemplate() {
		try {
			if (!exportRef.current) return;

			setErr(null);
			setOk(null);
			setExporting(true);

			// wait fonts
			// @ts-ignore
			if (document.fonts?.ready) {
				// @ts-ignore
				await document.fonts.ready;
			}

			const node = exportRef.current;

			const dataUrl = await toPng(node, {
				cacheBust: true,
				pixelRatio: 2,
				backgroundColor: 'white',
			});

			const a = document.createElement('a');
			a.href = dataUrl;
			a.download = `outer-assignments-template-${new Date().toISOString().slice(0, 10)}.png`;
			a.click();
		} catch (e: any) {
			setErr(e?.message || 'Export failed');
		} finally {
			setExporting(false);
		}
	}

	return (
		<div className="mx-auto w-full max-w-[1600px] px-4 space-y-6">
			{/* Header */}
			<div className="rounded-xl border bg-white px-5 py-4 shadow-sm flex items-start justify-between gap-4">
				<div className="flex items-start gap-3">
					<div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand-600">
						<CalendarDays className="h-5 w-5" />
					</div>
					<div>
						<h1 className="text-2xl md:text-3xl font-bold tracking-tight">Outer Appointment Assignment</h1>
						<div className="text-sm text-gray-600 mt-1">
							Upcoming appointments with status <b>Need Confirmation</b> or <b>Confirmed</b> (Service Type: <b>Outer</b>)
						</div>
					</div>
				</div>

				<div className="flex flex-col items-end gap-2">
					<div className="text-xs text-gray-600">
						<span className="inline-flex items-center gap-2">
							<Users className="h-4 w-4" />
							Total: <b>{stats.total}</b> · Staff selected: <b>{stats.assigned}</b>
							{stats.missingRemark ? (
								<span className="text-red-600"> · Missing remarks: <b>{stats.missingRemark}</b></span>
							) : null}
						</span>
					</div>

					<div className="flex items-center gap-2">
						<button
							type="button"
							className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
							onClick={() => loadAssignments(labId)}
							disabled={loading || saving}
							title="Refresh"
						>
							<RefreshCcw className="h-4 w-4" />
							Refresh
						</button>

						<button
							type="button"
							className="inline-flex items-center gap-2 rounded border px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-60"
							onClick={exportPngTemplate}
							disabled={loading || exporting}
							title="Export template as PNG"
						>
							<Download className="h-4 w-4" />
							{exporting ? 'Exporting…' : 'Export PNG'}
						</button>

						<button
							type="button"
							className="inline-flex items-center gap-2 rounded bg-brand text-white px-4 py-2 text-sm disabled:opacity-60"
							onClick={saveAll}
							disabled={loading || saving || rows.length === 0}
							title="Save all assignment rows"
						>
							<Save className="h-4 w-4" />
							{saving ? 'Saving…' : 'Save All'}
						</button>
					</div>
				</div>
			</div>

			{/* Alerts */}
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

			{/* Main card */}
			<div className="rounded-xl border bg-white shadow-sm">
				{/* Toolbar */}
				<div className="p-4 border-b flex flex-wrap items-end gap-3 justify-between">
					<div>
						<div className="text-base font-semibold">Assignment List</div>
						<div className="text-xs text-gray-600 mt-1">
							Fill <b>Staff</b> + <b>Address Remark</b>, then click <b>Save All</b>.
						</div>
					</div>

					{/* Lab filter */}
					<div className="flex items-end gap-2">
						<div>
							<label className="block text-xs text-gray-600 mb-1">Lab</label>
							<select
								className="border rounded px-3 py-2 min-w-[260px]"
								value={labId}
								onChange={(e) => setLabId(e.target.value)}
							>
								<option value="">All Labs</option>
								{labs.map(l => (
									<option key={l.id} value={l.id}>
										{l.nickName || l.name} {l.labCode ? `(${l.labCode})` : ''}
									</option>
								))}
							</select>
						</div>
					</div>
				</div>

				{/* Table */}
				<div className="p-4">
					<div className="w-full overflow-x-auto">
						<div className="max-h-[620px] overflow-y-auto rounded border">
							<table className="w-full min-w-[1400px]">
								<thead className="sticky top-0 z-10 bg-white">
									<tr className="border-b bg-gray-50">
										<th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Appointment</th>
										<th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Client Name</th>
										<th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Mobile No</th>
										<th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Insurance</th>
										<th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Test</th>
										<th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Location</th>
										<th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Staff</th>
										<th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Address Remark</th>
										<th className="px-3 py-2 text-left text-xs font-semibold text-gray-700">Status</th>
									</tr>
								</thead>

								<tbody>
									{loading ? (
										<tr>
											<td colSpan={9} className="px-3 py-6 text-center text-sm text-gray-500">Loading…</td>
										</tr>
									) : rows.length === 0 ? (
										<tr>
											<td colSpan={9} className="px-3 py-6 text-center text-sm text-gray-500">
												No upcoming outer appointments found.
											</td>
										</tr>
									) : (
										rows.map((r) => {
											const assignedToId = (draftAssignedTo[r.id] ?? r.assignedToId ?? '').trim();
											const remark = draftRemark[r.id] ?? r.addressRemark ?? '';

											return (
												<tr key={r.id} className="border-t hover:bg-gray-50">
													<td className="px-3 py-2 text-sm whitespace-nowrap">
														<div className="font-medium text-gray-900">
															{formatDateOnly(r.apptAt)} <span className="text-gray-500">{formatTime(r.apptAt)}</span>
														</div>
														{!labId && (
															<div className="text-xs text-gray-500">
																{r.labNick || r.labCode || r.labName || r.labId}
															</div>
														)}
													</td>

													<td className="px-3 py-2 text-sm whitespace-nowrap">{r.clientName}</td>
													<td className="px-3 py-2 text-sm whitespace-nowrap">{r.mobileNo}</td>
													<td className="px-3 py-2 text-sm">{r.insuranceName}</td>
													<td className="px-3 py-2 text-sm whitespace-nowrap">{r.testSummary}</td>
													<td className="px-3 py-2 text-sm">{r.location}</td>

													<td className="px-3 py-2 text-sm">
														<select
															className="w-full border rounded px-2 py-1.5 bg-white"
															value={assignedToId}
															onChange={(e) => setDraftAssignedTo((p) => ({ ...p, [r.id]: e.target.value }))}
														>
															<option value="">Select User</option>
															{users.map(u => (
																<option key={u.id} value={u.id}>
																	{userLabel(u)}
																</option>
															))}
														</select>
													</td>

													<td className="px-3 py-2 text-sm">
														<input
															className="w-full border rounded px-2 py-1.5"
															placeholder="Enter address / landmark / remark"
															value={remark}
															onChange={(e) => setDraftRemark((p) => ({ ...p, [r.id]: e.target.value }))}
														/>
													</td>

													<td className="px-3 py-2 text-sm whitespace-nowrap">{r.status}</td>
												</tr>
											);
										})
									)}
								</tbody>
							</table>
						</div>
					</div>

					<div className="text-xs text-gray-500 mt-3">
						Export PNG will use the clean assignment template (not this table).
					</div>
				</div>
			</div>

			{/* ===================== */}
			{/* EXPORT TEMPLATE ONLY  */}
			{/* ===================== */}
			<div className="fixed -left-[100000px] top-0">
				<div
					ref={exportRef}
					className="bg-white text-black"
					style={{
						width: '900px',
						padding: '24px',
						fontFamily:
							'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"',
					}}
				>
					<div className="text-xl font-bold">Outer Appointment Assignment</div>
					<div className="text-sm text-gray-700 mt-1">
						Date: <b>{new Date().toISOString().slice(0, 10)}</b>
						{labId ? (
							<span>
								{' '}· Lab:{' '}
								<b>{labs.find(l => l.id === labId)?.nickName || labs.find(l => l.id === labId)?.name || labId}</b>
							</span>
						) : (
							<span> · Lab: <b>All Labs</b></span>
						)}
					</div>

					<div className="mt-4" style={{ borderTop: '2px solid #111', paddingTop: '12px' }}>
						{groupedForExport.length === 0 ? (
							<div className="text-sm text-gray-700">No rows to export.</div>
						) : (
							groupedForExport.map((g, idx) => {
								const assigneeNo = idx + 1;
								const staffName = g.staffName;

								return (
									<div key={g.staffId} style={{ marginBottom: '24px' }}>
										<div className="text-base font-semibold">
											Assignee_{assigneeNo} : {staffName}
										</div>
										<div style={{ borderTop: '1px solid #111', marginTop: '6px', marginBottom: '10px' }} />

										{g.list.map((r) => {
											const address =
												(draftRemark[r.id] ?? r.addressRemark ?? '').trim() ||
												(r.location || '');

											return (
												<div key={r.id} style={{ marginBottom: '12px' }}>
													<div className="text-sm">
														<span className="font-semibold">Appointment</span> : {formatDateOnly(r.apptAt)} {formatTime(r.apptAt)}
													</div>
													<div className="text-sm">
														<span className="font-semibold">Client Name</span> : {r.clientName || '-'}
													</div>
													<div className="text-sm">
														<span className="font-semibold">Test</span> : {r.testSummary || '-'}
													</div>
													<div className="text-sm">
														<span className="font-semibold">Insurance Company</span> : {r.insuranceName || '-'}
													</div>
													<div className="text-sm">
														<span className="font-semibold">Mobile No</span> : {r.mobileNo || '-'}
													</div>
													<div className="text-sm">
														<span className="font-semibold">Address</span> : {address || '-'}
													</div>

													<div style={{ borderTop: '1px dashed #444', marginTop: '10px' }} />
												</div>
											);
										})}

										<div style={{ borderTop: '2px solid #111', marginTop: '14px' }} />
									</div>
								);
							})
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
