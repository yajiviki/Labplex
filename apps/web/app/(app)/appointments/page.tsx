'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, Search, Trash2, Edit3, ChevronDown, ChevronUp } from 'lucide-react';

type Vendor = {
	id: string;
	vendorId: string;    // TPA01…
	tpaName: string;
	insuranceName?: string | null;
	companies?: { id: string; name: string; code?: string | null }[];
};
type Lab = { id: string; labCode: string; name: string };

type Appointment = {
	id: string;
	apptAt: string;                 // ISO
	vendorId: string | null;        // FK -> Vendor.id
	insuranceCompanyId: string | null;
	labId: string | null;
	clientName: string | null;
	clientRef: string | null;       // Client Id/Proposal No
	gender: string | null;
	age: number | null;
	address: string | null;
	phone: string | null;           // Mobile No
	visitType: string | null;       // CENTER | HOME
	location: string | null;
	status: string | null;          // merged single field
	extraChargeRs: number | null;
	paymentStatus: string | null;   // Paid | On Account
	createdAt: string;
};

const GENDER_OPTS = ['Male', 'Female'] as const;
const VISIT_TYPE_OPTS = [
	{ value: 'CENTER', label: 'Center' },
	{ value: 'HOME', label: 'Home' },
] as const;

/** Single Status list (medical + report) */
const STATUS_OPTS = [
	'TBI',
	'On hold',
	'Waiting for response',
	'Not Responding',
	'Rescheduled',
	'Need Confirmation',
	'Sample Collected',
	'Medical Done',
	'Cancelled',
	'Report - InProgress',
	'Report - Completed',
	'Report - Submitted',
] as const;

const PAYMENT_STATUS_OPTS = ['TBI', 'Paid', 'On Account'] as const;

function toDateLocalValue(d?: string | Date | null) {
	if (!d) return '';
	const dt = typeof d === 'string' ? new Date(d) : d;
	const pad = (n: number) => String(n).padStart(2, '0');
	const yyyy = dt.getFullYear();
	const mm = pad(dt.getMonth() + 1);
	const dd = pad(dt.getDate());
	const hh = pad(dt.getHours());
	const mi = pad(dt.getMinutes());
	return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}
function fromDateLocalValue(v: string) { return v ? new Date(v).toISOString() : null; }

export default function AppointmentsPage() {
	const [loading, setLoading] = useState(false);
	const [rows, setRows] = useState<Appointment[]>([]);
	const [vendors, setVendors] = useState<Vendor[]>([]);
	const [labs, setLabs] = useState<Lab[]>([]);

	// form state
	const [editingId, setEditingId] = useState<string | null>(null);
	const [apptAt, setApptAt] = useState<string>(toDateLocalValue(new Date()));
	const [vendorId, setVendorId] = useState<string>('');                     // Vendor.id
	const [insuranceCompanyId, setInsuranceCompanyId] = useState<string>(''); // InsuranceCompany.id
	const [labId, setLabId] = useState<string>('');
	const [clientName, setClientName] = useState('');
	const [clientRef, setClientRef] = useState('');
	const [gender, setGender] = useState<string>('');
	const [age, setAge] = useState<string>('');
	const [address, setAddress] = useState('');
	const [phone, setPhone] = useState('');
	const [visitType, setVisitType] = useState<string>('CENTER');
	const [location, setLocation] = useState('');
	const [status, setStatus] = useState<string>('TBI');
	const [extraChargeRs, setExtraChargeRs] = useState<string>('');
	const [paymentStatus, setPaymentStatus] = useState<string>('On Account');

	// messages
	const [formErr, setFormErr] = useState<string | null>(null);
	const [formOk, setFormOk] = useState<string | null>(null);
	const [listErr, setListErr] = useState<string | null>(null);

	// filters
	const [q, setQ] = useState('');
	const [fDateFrom, setFDateFrom] = useState<string>('');
	const [fDateTo, setFDateTo] = useState<string>('');
	const [fStatus, setFStatus] = useState<string>(''); // single status filter
	const [sortKey, setSortKey] = useState<keyof Appointment>('apptAt');
	const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

	async function load() {
		setLoading(true); setListErr(null);
		try {
			const [rVendors, rLabs, rAppts] = await Promise.all([
				fetch('/api/vendors?include=companies', { cache: 'no-store' }),
				fetch('/api/labs', { cache: 'no-store' }),
				fetch('/api/appointments?q=', { cache: 'no-store' }),
			]);
			const [vendorsJson, labsJson, apptsJson] = await Promise.all([
				rVendors.json().catch(() => []),
				rLabs.json().catch(() => []),
				rAppts.json().catch(() => []),
			]);
			if (!rVendors.ok) throw new Error(vendorsJson?.error || 'Load vendors failed');
			if (!rLabs.ok) throw new Error(labsJson?.error || 'Load labs failed');
			if (!rAppts.ok) throw new Error(apptsJson?.error || 'Load appointments failed');
			setVendors(Array.isArray(vendorsJson) ? vendorsJson : []);
			setLabs(Array.isArray(labsJson) ? labsJson : []);
			setRows(Array.isArray(apptsJson) ? apptsJson : []);
		} catch (e: any) {
			setListErr(e?.message || 'Network error');
			setVendors([]); setLabs([]); setRows([]);
		} finally { setLoading(false); }
	}
	useEffect(() => { load(); }, []);

	// insurance dropdown driven by selected vendor
	const vendorCompanies = useMemo(() => {
		const v = vendors.find(x => x.id === vendorId);
		return v?.companies || [];
	}, [vendors, vendorId]);

	function resetForm() {
		setEditingId(null);
		setApptAt(toDateLocalValue(new Date()));
		setVendorId(''); setInsuranceCompanyId(''); setLabId('');
		setClientName(''); setClientRef('');
		setGender(''); setAge(''); setAddress(''); setPhone('');
		setVisitType('CENTER'); setLocation('');
		setStatus('TBI');
		setExtraChargeRs(''); setPaymentStatus('On Account');
		setFormErr(null); setFormOk(null);
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setFormErr(null); setFormOk(null);

		if (!apptAt) { setFormErr('Appointment Date is required'); return; }
		if (!vendorId) { setFormErr('TPA Name is required'); return; }
		if (!labId) { setFormErr('Lab Name is required'); return; }
		if (!insuranceCompanyId) { setFormErr('Insurance name is required'); return; }
		if (!clientName.trim()) { setFormErr('Client Name is required'); return; }
		if (!visitType) { setFormErr('Type of Visit is required'); return; }
		if (!status) { setFormErr('Status is required'); return; }
		if (!paymentStatus) { setFormErr('Payment Status is required'); return; }

		const payload = {
			apptAt: fromDateLocalValue(apptAt),
			vendorId,                           // new
			insuranceVendorId: vendorId,        // legacy compatibility if server expects it
			labId,
			insuranceCompanyId,
			patientName: clientName || null,    // legacy
			clientName: clientName || null,
			clientRef: clientRef || null,
			gender: gender || null,
			age: age ? Number(age) : null,
			address: address || null,
			phone: phone || null,
			visitType,
			location: location || null,
			status,
			extraChargeRs: extraChargeRs ? Number(extraChargeRs) : null,
			paymentStatus,
			source: 'INSURANCE',
		};

		try {
			const res = await fetch(editingId ? `/api/appointments/${editingId}` : '/api/appointments', {
				method: editingId ? 'PUT' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) { setFormErr(data?.error || 'Save failed'); return; }
			setFormOk(editingId ? 'Updated!' : 'Created!');
			await load();
			if (!editingId) resetForm();
		} catch (e: any) {
			setFormErr(e?.message || 'Network error');
		}
	}

	function startEdit(a: Appointment) {
		setEditingId(a.id);
		setApptAt(toDateLocalValue(a.apptAt));
		setVendorId(a.vendorId || '');
		setInsuranceCompanyId(a.insuranceCompanyId || '');
		setLabId(a.labId || '');
		setClientName(a.clientName || '');
		setClientRef(a.clientRef || '');
		setGender(a.gender || '');
		setAge(a.age != null ? String(a.age) : '');
		setAddress(a.address || '');
		setPhone(a.phone || '');
		setVisitType(a.visitType || 'CENTER');
		setLocation(a.location || '');
		setStatus(a.status || 'TBI');
		setExtraChargeRs(a.extraChargeRs != null ? String(a.extraChargeRs) : '');
		setPaymentStatus(a.paymentStatus || 'On Account');
		setFormErr(null); setFormOk(null);
	}

	async function onDeleteOne(id: string) {
		if (!confirm('Delete this appointment?')) return;
		try {
			const r = await fetch(`/api/appointments/${id}`, { method: 'DELETE' });
			if (!r.ok) {
				const j = await r.json().catch(() => ({}));
				alert(j?.error || 'Delete failed');
				return;
			}
			await load();
		} catch { /* noop */ }
	}

	function inDateRange(apptISO: string) {
		if (!fDateFrom && !fDateTo) return true;
		const t = new Date(apptISO).getTime();
		if (fDateFrom) {
			const from = new Date(fDateFrom + 'T00:00:00').getTime();
			if (t < from) return false;
		}
		if (fDateTo) {
			const to = new Date(fDateTo + 'T23:59:59').getTime();
			if (t > to) return false;
		}
		return true;
	}

	const filtered = useMemo(() => {
		const term = q.trim().toLowerCase();
		const base = rows.filter(r => {
			const textOk = term
				? [r.clientName, r.clientRef, r.phone, r.location]
					.filter(Boolean)
					.some(v => String(v).toLowerCase().includes(term))
				: true;
			const dateOk = inDateRange(r.apptAt);
			const statusOk = fStatus ? (r.status === fStatus) : true;
			return textOk && dateOk && statusOk;
		});

		const sorted = [...base].sort((a, b) => {
			const va = (a[sortKey] ?? '') as any; const vb = (b[sortKey] ?? '') as any;
			if (va === vb) return 0;
			return (sortDir === 'asc') ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
		});
		return sorted;
	}, [rows, q, sortKey, sortDir, fDateFrom, fDateTo, fStatus]);

	const [sortKeyState, setSortKeyState] = useState<keyof Appointment>('apptAt');
	const [sortDirState, setSortDirState] = useState<'asc' | 'desc'>('desc');
	function sortBy(k: keyof Appointment) {
		if (k === sortKeyState) setSortDirState(sortDirState === 'asc' ? 'desc' : 'asc');
		else { setSortKeyState(k); setSortDirState('asc'); }
		setSortKey(k); setSortDir(sortDirState);
	}
	const Col = ({ k, label }: { k: keyof Appointment; label: string }) => {
		const active = sortKeyState === k;
		return (
			<th
				className="px-3 py-2 text-left text-sm font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap"
				onClick={() => sortBy(k)}
			>
				<div className="inline-flex items-center gap-1">
					<span>{label}</span>
					{active ? (sortDirState === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : null}
				</div>
			</th>
		);
	};

	return (
		<div className="mx-auto w-full max-w-[1600px] px-4 space-y-6">
			{/* Title */}
			<div className="rounded-xl border bg-white px-5 py-4 shadow-sm flex items-center gap-3">
				<div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand-600">
					<CalendarPlus className="h-5 w-5" />
				</div>
				<h1 className="text-2xl md:text-3xl font-bold tracking-tight">Appointment Management</h1>
			</div>

			{/* FORM — 5 columns per row (your layout spec: 3 rows) */}
			<div className="rounded-xl border bg-white p-4 shadow-sm">
				<div className="flex items-center justify-between mb-3">
					<h2 className="text-base font-semibold">{editingId ? 'Update Appointment' : 'Add New Appointment'}</h2>
					<button onClick={resetForm} className="text-sm text-gray-600 hover:underline">Clear</button>
				</div>

				{formErr && <div className="mb-3 text-sm text-red-600">{formErr}</div>}
				{formOk && <div className="mb-3 text-sm text-green-600">{formOk}</div>}

				<form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3">
					{/* Row 1: Appointment Date, Type of Visit, TPA Name, Insurance Name, Lab Name */}
					<div>
						<label className="block text-sm mb-1">Appointment Date</label>
						<input type="datetime-local" value={apptAt} onChange={(e) => setApptAt(e.target.value)} className="w-full border rounded px-3 py-2" />
					</div>

					<div>
						<label className="block text-sm mb-1">Type of Visit</label>
						<select className="w-full border rounded px-3 py-2" value={visitType} onChange={(e) => setVisitType(e.target.value)}>
							{VISIT_TYPE_OPTS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
						</select>
					</div>

					<div>
						<label className="block text-sm mb-1">TPA Name</label>
						<select className="w-full border rounded px-3 py-2" value={vendorId} onChange={(e) => { setVendorId(e.target.value); setInsuranceCompanyId(''); }}>
							<option value="">Select TPA</option>
							{vendors.map(v => <option key={v.id} value={v.id}> {v.tpaName}</option>)}
						</select>
					</div>

					<div>
						<label className="block text-sm mb-1">Insurance Name</label>
						<select className="w-full border rounded px-3 py-2" value={insuranceCompanyId} onChange={(e) => setInsuranceCompanyId(e.target.value)} disabled={!vendorId}>
							<option value="">Select Insurance</option>
							{vendorCompanies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
						</select>
					</div>

					<div>
						<label className="block text-sm mb-1">Lab Name</label>
						<select className="w-full border rounded px-3 py-2" value={labId} onChange={(e) => setLabId(e.target.value)}>
							<option value="">Select Lab</option>
							{labs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
						</select>
					</div>

					{/* Row 2: Client Name, Client Id/Proposal No, Gender, Age, Address, Location */}
					<div>
						<label className="block text-sm mb-1">Client Name</label>
						<input className="w-full border rounded px-3 py-2" value={clientName} onChange={(e) => setClientName(e.target.value)} />
					</div>

					<div>
						<label className="block text-sm mb-1">Client Id/Proposal No</label>
						<input className="w-full border rounded px-3 py-2" value={clientRef} onChange={(e) => setClientRef(e.target.value)} />
					</div>

					<div>
						<label className="block text-sm mb-1">Gender</label>
						<select className="w-full border rounded px-3 py-2" value={gender} onChange={(e) => setGender(e.target.value)}>
							<option value="">Select…</option>
							{GENDER_OPTS.map(g => <option key={g} value={g}>{g}</option>)}
						</select>
					</div>

					<div>
						<label className="block text-sm mb-1">Age</label>
						<input type="number" min={0} className="w-full border rounded px-3 py-2" value={age} onChange={(e) => setAge(e.target.value)} />
					</div>

					<div>
						<label className="block text-sm mb-1">Address</label>
						<input className="w-full border rounded px-3 py-2" value={address} onChange={(e) => setAddress(e.target.value)} />
					</div>

					<div>
						<label className="block text-sm mb-1">Location</label>
						<input className="w-full border rounded px-3 py-2" value={location} onChange={(e) => setLocation(e.target.value)} />
					</div>

					{/* Row 3: Mobile No, Status, Payment Status, Extra Charge (Rs) */}
					<div>
						<label className="block text-sm mb-1">Mobile No</label>
						<input className="w-full border rounded px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
					</div>

					<div>
						<label className="block text-sm mb-1">Status</label>
						<select className="w-full border rounded px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value)}>
							{STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
						</select>
					</div>

					<div>
						<label className="block text-sm mb-1">Payment Status</label>
						<select className="w-full border rounded px-3 py-2" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
							{PAYMENT_STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
						</select>
					</div>

					<div>
						<label className="block text-sm mb-1">Extra Charge (Rs)</label>
						<input type="number" min={0} className="w-full border rounded px-3 py-2" value={extraChargeRs} onChange={(e) => setExtraChargeRs(e.target.value)} />
					</div>

					<div className="md:col-span-5 flex gap-2 mt-1">
						<button className="rounded bg-brand text-white px-4 py-2">{editingId ? 'Update' : 'Create'}</button>
						<button type="button" className="rounded border px-4 py-2" onClick={resetForm}>Reset</button>
					</div>
				</form>
			</div>

			{/* FILTER BAR */}
			<div className="rounded-xl border bg-white p-4 shadow-sm">
				<div className="flex flex-wrap items-end gap-3">
					<div className="grow md:grow-0 relative">
						<label className="block text-xs text-gray-600 mb-1">Search</label>
						<div>
							<Search className="h-4 w-4 absolute left-3 top-[34px] text-gray-400" />
							<input
								placeholder="Client, Proposal Id, Phone, Location…"
								className="pl-9 pr-3 py-2 border rounded w-72"
								value={q}
								onChange={(e) => setQ(e.target.value)}
							/>
						</div>
					</div>

					<div>
						<label className="block text-xs text-gray-600 mb-1">Date From</label>
						<input type="date" className="border rounded px-3 py-2" value={fDateFrom} onChange={(e) => setFDateFrom(e.target.value)} />
					</div>
					<div>
						<label className="block text-xs text-gray-600 mb-1">Date To</label>
						<input type="date" className="border rounded px-3 py-2" value={fDateTo} onChange={(e) => setFDateTo(e.target.value)} />
					</div>

					<div>
						<label className="block text-xs text-gray-600 mb-1">Status</label>
						<select className="border rounded px-3 py-2 min-w-[220px]" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
							<option value="">All</option>
							{STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
						</select>
					</div>
				</div>
			</div>

			{/* TABLE */}
			<div className="rounded-xl border bg-white p-4 shadow-sm">
				<div className="w-full">
					<table className="w-full border rounded">
						<thead className="bg-gray-50">
							<tr>
								<Col k="apptAt" label="Appointment Date" />
								<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">TPA Name</th>
								<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">Lab Name</th>
								<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">Insurance name</th>
								<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">Client Name</th>
								<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">Client Id/Proposal No</th>
								<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">Mobile No</th>
								<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">Type of Visit</th>
								<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">Location</th>
								<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">Status</th>
								<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">Extra Charge (Rs)</th>
								<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">Payment Status</th>
								<th className="px-3 py-2" />
							</tr>
						</thead>
						<tbody>
							{loading ? (
								<tr><td colSpan={14} className="px-3 py-4 text-center text-sm text-gray-500">Loading…</td></tr>
							) : filtered.length === 0 ? (
								<tr><td colSpan={14} className="px-3 py-4 text-center text-sm text-gray-500">No appointments found</td></tr>
							) : (
								filtered.map((a) => {
									const tpa = vendors.find(v => v.id === a.vendorId);
									const lab = labs.find(l => l.id === a.labId);
									const ins = (tpa?.companies || []).find(c => c.id === a.insuranceCompanyId);
									return (
										<tr key={a.id} className="border-t hover:bg-gray-50">
											<td className="px-3 py-2 text-sm whitespace-nowrap">{new Date(a.apptAt).toLocaleString()}</td>
											<td className="px-3 py-2 text-sm">{tpa?.tpaName || ''}</td>
											<td className="px-3 py-2 text-sm">{lab?.name || ''}</td>
											<td className="px-3 py-2 text-sm">{ins?.name || ''}</td>
											<td className="px-3 py-2 text-sm">{a.clientName || ''}</td>
											<td className="px-3 py-2 text-sm">{a.clientRef || ''}</td>
											<td className="px-3 py-2 text-sm whitespace-nowrap">{a.phone || ''}</td>
											<td className="px-3 py-2 text-sm">{a.visitType === 'CENTER' ? 'Center' : (a.visitType === 'HOME' ? 'Home' : '')}</td>
											<td className="px-3 py-2 text-sm">{a.location || ''}</td>
											<td className="px-3 py-2 text-sm whitespace-nowrap">{a.status || ''}</td>
											<td className="px-3 py-2 text-sm text-right">{a.extraChargeRs ?? ''}</td>
											<td className="px-3 py-2 text-sm whitespace-nowrap">{a.paymentStatus || ''}</td>
											<td className="px-3 py-2 text-sm">
												<div className="flex items-center gap-1">
													<button className="p-1 rounded border hover:bg-gray-50" title="Edit" onClick={() => startEdit(a)}>
														<Edit3 className="h-4 w-4" />
													</button>
													<button className="p-1 rounded border hover:bg-gray-50" title="Delete" onClick={() => onDeleteOne(a.id)}>
														<Trash2 className="h-4 w-4 text-red-600" />
													</button>
												</div>
											</td>
										</tr>
									);
								})
							)}
						</tbody>
					</table>
				</div>

				{listErr && <div className="mt-3 text-sm text-red-600">{listErr}</div>}
			</div>
		</div>
	);
}
