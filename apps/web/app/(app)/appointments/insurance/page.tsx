'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, ChevronDown, ChevronUp, Search, Trash2, Building2 } from 'lucide-react';
import { SOURCES, VISIT_TYPES, STATUSES } from '../_components/ApptCommon';

type Row = {
	id: string;
	patientId: string | null;
	patientName: string | null;
	phone: string | null;
	source: string;
	visitType: string;
	doctorName: string | null;
	insuranceVendorId: string | null;
	apptAt: string; // ISO
	status: string;
	tatHours: number | null;
	notes: string | null;
	createdAt: string;
};

type SortKey = keyof Pick<Row, 'apptAt' | 'patientId' | 'patientName' | 'phone' | 'source' | 'visitType' | 'status' | 'tatHours'>;
type SortDir = 'asc' | 'desc';

export default function InsuranceAppointmentsPage() {
	// table
	const [rows, setRows] = useState<Row[]>([]);
	const [loading, setLoading] = useState(false);
	const [q, setQ] = useState('');
	const [statusFilter, setStatusFilter] = useState<string>('');
	const [dateFrom, setDateFrom] = useState<string>('');
	const [dateTo, setDateTo] = useState<string>('');
	const [sortKey, setSortKey] = useState<SortKey>('apptAt');
	const [sortDir, setSortDir] = useState<SortDir>('desc');
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const anySelected = selected.size > 0;

	// form (left)
	const [patientId, setPatientId] = useState('');
	const [patientName, setPatientName] = useState('');
	const [phone, setPhone] = useState('');
	const [source, setSource] = useState<string>('INSURANCE'); // default for this page
	const [visitType, setVisitType] = useState<string>('CENTER');
	const [doctorName, setDoctorName] = useState('');
	const [vendorId, setVendorId] = useState('');
	const [apptAt, setApptAt] = useState<string>(''); // datetime-local
	const [status, setStatus] = useState<string>('BOOKED');
	const [tatHours, setTatHours] = useState<number | ''>('');
	const [notes, setNotes] = useState('');
	const [err, setErr] = useState<string | null>(null);
	const [ok, setOk] = useState<string | null>(null);
	const [editingId, setEditingId] = useState<string | null>(null);

	async function load() {
		setLoading(true);
		setSelected(new Set());
		try {
			const params = new URLSearchParams();
			if (q) params.set('q', q);
			if (statusFilter) params.set('status', statusFilter);
			params.set('source', 'INSURANCE'); // page-pinned
			if (dateFrom) params.set('dateFrom', new Date(dateFrom).toISOString());
			if (dateTo) params.set('dateTo', new Date(dateTo).toISOString());

			const res = await fetch(`/api/appointments?${params.toString()}`, { cache: 'no-store' });
			const data = await res.json().catch(() => []);
			if (!res.ok) throw new Error(data?.error || `Load failed (${res.status})`);
			setRows(Array.isArray(data) ? data : []);
		} catch (e: any) {
			setErr(e?.message || 'Load error');
			setRows([]);
		} finally {
			setLoading(false);
		}
	}
	useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

	function resetForm() {
		setEditingId(null);
		setPatientId('');
		setPatientName('');
		setPhone('');
		setSource('INSURANCE');
		setVisitType('CENTER');
		setDoctorName('');
		setVendorId('');
		setApptAt('');
		setStatus('BOOKED');
		setTatHours('');
		setNotes('');
		setErr(null); setOk(null);
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setErr(null); setOk(null);
		if (!source || !visitType || !apptAt) return setErr('Please fill Source, Visit Type and Appointment Date/Time.');
		const payload: any = {
			patientId: patientId || null,
			patientName: patientName || null,
			phone: phone || null,
			source, visitType,
			doctorName: doctorName || null,
			insuranceVendorId: vendorId || null,
			apptAt: new Date(apptAt).toISOString(),
			status,
			tatHours: (tatHours === '' ? null : Number(tatHours)),
			notes: notes || null,
		};

		const url = editingId ? `/api/appointments/${editingId}` : '/api/appointments';
		const method = editingId ? 'PUT' : 'POST';
		const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
		const data = await res.json().catch(() => ({}));
		if (!res.ok) return setErr(data?.error || 'Save failed');

		setOk(editingId ? 'Updated!' : 'Created!');
		await load();
		if (!editingId) resetForm();
	}

	function startEdit(r: Row) {
		setEditingId(r.id);
		setPatientId(r.patientId || '');
		setPatientName(r.patientName || '');
		setPhone(r.phone || '');
		setSource(r.source);
		setVisitType(r.visitType);
		setDoctorName(r.doctorName || '');
		setVendorId(r.insuranceVendorId || '');
		setApptAt(r.apptAt.slice(0, 16)); // yyyy-mm-ddTHH:MM
		setStatus(r.status);
		setTatHours(r.tatHours ?? '');
		setNotes(r.notes || '');
	}

	async function deleteSelected() {
		if (!anySelected) return;
		if (!confirm(`Delete ${selected.size} selected appointment(s)?`)) return;
		const ids = Array.from(selected);
		await Promise.all(ids.map(async (id) => {
			await fetch(`/api/appointments/${id}`, { method: 'DELETE' });
		}));
		setSelected(new Set());
		await load();
	}

	const filteredSorted = useMemo(() => {
		const base = rows;
		const sorted = [...base].sort((a, b) => {
			const va = (a[sortKey] ?? '') as any;
			const vb = (b[sortKey] ?? '') as any;
			if (va === vb) return 0;
			if (sortDir === 'asc') return va > vb ? 1 : -1;
			return va < vb ? 1 : -1;
		});
		return sorted;
	}, [rows, sortKey, sortDir]);

	function sortBy(k: SortKey) {
		if (k === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
		else { setSortKey(k); setSortDir('asc'); }
	}

	function toggleOne(id: string, checked: boolean) {
		setSelected(prev => {
			const next = new Set(prev);
			if (checked) next.add(id); else next.delete(id);
			return next;
		});
	}
	function selectAllVisible(checked: boolean) {
		if (!checked) return setSelected(new Set());
		setSelected(new Set(filteredSorted.map(r => r.id)));
	}

	const Col = ({ k, label }: { k: SortKey; label: string }) => {
		const active = sortKey === k;
		return (
			<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700 cursor-pointer select-none" onClick={() => sortBy(k)}>
				<div className="inline-flex items-center gap-1">
					<span>{label}</span>
					{active ? (sortDir === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : null}
				</div>
			</th>
		);
	};

	return (
		<div className="space-y-4">
			{/* Title bar */}
			<div className="rounded-xl border bg-white px-5 py-4 shadow-sm flex items-center gap-3">
				<div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand-600">
					<Building2 className="h-5 w-5" />
				</div>
				<h1 className="text-2xl md:text-3xl font-bold tracking-tight">Appointments — Insurance Vendor</h1>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

				{/* Form */}
				<div className="lg:col-span-4 rounded-xl border bg-white p-4 shadow-sm">
					<div className="flex items-center justify-between mb-3">
						<h2 className="text-base font-semibold">{editingId ? 'Update Appointment' : 'Create Appointment'}</h2>
						<button onClick={resetForm} className="text-sm text-gray-600 hover:underline">Clear</button>
					</div>

					{err && <div className="mb-3 text-sm text-red-600">{err}</div>}
					{ok && <div className="mb-3 text-sm text-green-600">{ok}</div>}

					<form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-3">
						<div>
							<label className="block text-sm mb-1">Patient ID</label>
							<input className="w-full border rounded px-3 py-2" value={patientId} onChange={(e) => setPatientId(e.target.value)} placeholder="OP0001" />
						</div>
						<div>
							<label className="block text-sm mb-1">Patient Name</label>
							<input className="w-full border rounded px-3 py-2" value={patientName} onChange={(e) => setPatientName(e.target.value)} />
						</div>

						<div>
							<label className="block text-sm mb-1">Phone</label>
							<input className="w-full border rounded px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
						</div>
						<div>
							<label className="block text-sm mb-1">Visit Type *</label>
							<select className="w-full border rounded px-3 py-2" value={visitType} onChange={(e) => setVisitType(e.target.value)}>
								{VISIT_TYPES.map(v => <option key={v.v} value={v.v}>{v.label}</option>)}
							</select>
						</div>

						<div>
							<label className="block text-sm mb-1">Source *</label>
							<select className="w-full border rounded px-3 py-2" value={source} onChange={(e) => setSource(e.target.value)}>
								{SOURCES.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
							</select>
						</div>
						<div>
							<label className="block text-sm mb-1">Vendor ID</label>
							<input className="w-full border rounded px-3 py-2" value={vendorId} onChange={(e) => setVendorId(e.target.value)} placeholder="INS-12345" />
						</div>

						<div>
							<label className="block text-sm mb-1">Doctor Name</label>
							<input className="w-full border rounded px-3 py-2" value={doctorName} onChange={(e) => setDoctorName(e.target.value)} />
						</div>
						<div>
							<label className="block text-sm mb-1">Status</label>
							<select className="w-full border rounded px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value)}>
								{STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
							</select>
						</div>

						<div>
							<label className="block text-sm mb-1">Appt Date/Time *</label>
							<input type="datetime-local" className="w-full border rounded px-3 py-2" value={apptAt} onChange={(e) => setApptAt(e.target.value)} />
						</div>
						<div>
							<label className="block text-sm mb-1">TAT (hrs)</label>
							<input type="number" className="w-full border rounded px-3 py-2" value={tatHours} onChange={(e) => setTatHours(e.target.value === '' ? '' : Number(e.target.value))} />
						</div>

						<div className="md:col-span-2">
							<label className="block text-sm mb-1">Notes</label>
							<textarea className="w-full border rounded px-3 py-2" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
						</div>

						<div className="md:col-span-2 flex gap-2 mt-1">
							<button className="rounded bg-brand text-white px-4 py-2">{editingId ? 'Update' : 'Create'}</button>
							<button type="button" className="rounded border px-4 py-2" onClick={resetForm}>Reset</button>
						</div>
					</form>
				</div>

				{/* Table */}
				<div className="lg:col-span-8 rounded-xl border bg-white p-4 shadow-sm">
					<div className="flex flex-wrap items-center gap-2 justify-between mb-3">
						<h2 className="text-base font-semibold">Appointment Information</h2>
						<div className="flex items-center gap-2">
							{anySelected && (
								<button
									type="button"
									onClick={deleteSelected}
									className="inline-flex items-center justify-center rounded border p-2 text-red-600 hover:bg-red-50"
									title="Delete selected"
									aria-label="Delete selected"
								>
									<Trash2 className="h-4 w-4" />
								</button>
							)}
							<div className="flex items-center gap-2">
								<select className="border rounded px-2 py-1.5 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
									<option value="">All Status</option>
									{STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
								</select>
								<div className="relative">
									<Search className="h-4 w-4 absolute left-2 top-2.5 text-gray-400" />
									<input
										placeholder="Search…"
										className="pl-8 pr-3 py-2 border rounded w-56"
										value={q}
										onChange={(e) => setQ(e.target.value)}
									/>
								</div>
								<input type="date" className="border rounded px-2 py-1.5 text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
								<span className="text-gray-500 text-sm">to</span>
								<input type="date" className="border rounded px-2 py-1.5 text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
								<button onClick={load} className="rounded border px-3 py-1.5 text-sm">Apply</button>
							</div>
						</div>
					</div>

					<div className="overflow-x-auto">
						<table className="min-w-full border rounded">
							<thead className="bg-gray-50">
								<tr>
									<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">
										<input
											type="checkbox"
											aria-label="Select all visible"
											checked={filteredSorted.length > 0 && filteredSorted.every(r => selected.has(r.id))}
											onChange={(e) => selectAllVisible(e.target.checked)}
										/>
									</th>
									<Col k="apptAt" label="Appt Time" />
									<Col k="patientId" label="Patient ID" />
									<Col k="patientName" label="Name" />
									<Col k="phone" label="Phone" />
									<Col k="visitType" label="Visit" />
									<Col k="status" label="Status" />
									<Col k="tatHours" label="TAT(h)" />
								</tr>
							</thead>
							<tbody>
								{loading ? (
									<tr><td colSpan={8} className="px-3 py-4 text-center text-sm text-gray-500">Loading…</td></tr>
								) : filteredSorted.length === 0 ? (
									<tr><td colSpan={8} className="px-3 py-4 text-center text-sm text-gray-500">No appointments</td></tr>
								) : (
									filteredSorted.map(r => {
										const isChecked = selected.has(r.id);
										return (
											<tr key={r.id} className="border-t hover:bg-gray-50">
												<td className="px-3 py-2 text-sm">
													<input
														type="checkbox"
														checked={isChecked}
														onChange={(e) => toggleOne(r.id, e.target.checked)}
													/>
												</td>
												<td className="px-3 py-2 text-sm">
													{new Date(r.apptAt).toLocaleString()}
												</td>
												<td className="px-3 py-2 text-sm">{r.patientId}</td>
												<td className="px-3 py-2 text-sm">
													<button className="underline underline-offset-2" onClick={() => startEdit(r)} title="Edit">
														{r.patientName || '—'}
													</button>
												</td>
												<td className="px-3 py-2 text-sm">{r.phone || '—'}</td>
												<td className="px-3 py-2 text-sm">{r.visitType}</td>
												<td className="px-3 py-2 text-sm">{r.status}</td>
												<td className="px-3 py-2 text-sm">{r.tatHours ?? '—'}</td>
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>

					{err && <div className="mt-3 text-sm text-red-600">{err}</div>}
					{ok && <div className="mt-1 text-sm text-green-600">{ok}</div>}
				</div>
			</div>
		</div>
	);
}
