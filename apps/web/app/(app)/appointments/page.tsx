'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
	CalendarPlus, Search, ChevronDown, ChevronUp, SlidersHorizontal,
	Trash2, X, AlertTriangle, Info
} from 'lucide-react';
import {
	ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip,
} from 'recharts';

/* ========= Types ========= */

type Vendor = { id: string; vendorId: string; tpaName: string; nickName: string; };
type Lab = { id: string; labCode: string; name: string; vendors?: Vendor[]; nickName: string; };
type Insurance = { id: string; code: string | null; name: string; address: string | null; nickName: string; };

type Appointment = {
	id: string;
	apptAt: string; // ISO
	vendorId: string | null;
	insuranceCompanyId: string | null;
	labId: string | null;

	clientName: string | null;
	clientRef: string | null;
	gender: string | null;
	age: number | null;
	phone: string | null;

	visitType: string | null; // CENTER | HOME
	location: string | null;
	status: string | null;

	serviceType: string | null;      // NEW
	paymentStatus: string | null;
	extraChargeRs: number | null;
	paymentDate: string | null;      // NEW (ISO date)

	createdAt: string;
};

const GENDER_OPTS = ['Male', 'Female'] as const;
const VISIT_TYPE_OPTS = [
	{ value: 'CENTER', label: 'Center' },
	{ value: 'HOME', label: 'Home' },
] as const;
const STATUS_OPTS = [
	'TBI', 'On hold', 'Waiting for response', 'Not Responding', 'Rescheduled', 'Need Confirmation',
	'Sample Collected', 'Medical Done', 'Cancelled', 'Report - InProgress', 'Report - Completed', 'Report - Submitted',
] as const;
const PAYMENT_STATUS_OPTS = ['TBI', 'Paid', 'On Account'] as const;
const SERVICE_TYPE_OPTS = ['Local', 'Outer Area', 'Others'] as const;

/* ========= Helpers ========= */

function toDateLocalValue(d?: string | Date | null) {
	if (!d) return '';
	const dt = typeof d === 'string' ? new Date(d.includes('T') ? d : d.replace(' ', 'T')) : d;
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}
function formatDateOnly(iso?: string | null): string {
	if (!iso) return '';
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function getCurrentMonthBounds() {
	const pad = (n: number) => String(n).padStart(2, '0');
	const now = new Date();
	const start = new Date(now.getFullYear(), now.getMonth(), 1);
	const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
	const from = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
	const to = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
	return { from, to };
}
function statusClasses(s?: string | null) {
	const key = (s || '').trim().toLowerCase();
	switch (key) {
		case 'tbi': return 'bg-purple-100 text-purple-800';
		case 'on hold':
		case 'not responding': return 'bg-yellow-100 text-yellow-800';
		case 'waiting for response': return 'bg-gray-100 text-gray-800';
		case 'rescheduled': return 'bg-red-100 text-red-800';
		case 'need confirmation': return 'bg-slate-200 text-slate-900';
		case 'sample collected': return 'bg-orange-100 text-orange-800';
		case 'medical done': return 'bg-blue-100 text-blue-800';
		case 'cancelled': return 'bg-blue-200 text-blue-900';
		case 'report - inprogress':
		case 'onprocess': return 'bg-yellow-200 text-black-900';
		case 'report - completed':
		case 'completed': return 'bg-green-100 text-green-800';
		case 'report - submitted':
		case 'submitted': return 'bg-green-100 text-green-800';
		default: return 'bg-gray-100 text-gray-800';
	}
}

/** Build daily trend counts from appointments; works for All Labs on first load */
function buildTrend(
	appts: Appointment[],
	opts: { labId: string; from: string; to: string }
) {
	const byDay = new Map<string, number>();

	let f = opts.from || '';
	let t = opts.to || '';
	if (f && t && f > t) [f, t] = [t, f];

	for (const r of appts) {
		if (opts.labId && r.labId !== opts.labId) continue; // if filtered lab, enforce
		const ymd = formatDateOnly(r.apptAt);
		if (!ymd) continue;
		if (f && ymd < f) continue;
		if (t && ymd > t) continue;
		byDay.set(ymd, (byDay.get(ymd) ?? 0) + 1);
	}

	return Array.from(byDay.entries())
		.sort((a, b) => (a[0] < b[0] ? -1 : 1))
		.map(([date, count]) => ({ date, count }));
}

/* ========= Page ========= */

export default function AppointmentsPage() {
	const [loading, setLoading] = useState(false);
	const [rows, setRows] = useState<Appointment[]>([]);
	const [vendors, setVendors] = useState<Vendor[]>([]);
	const [labs, setLabs] = useState<Lab[]>([]);
	const [insurers, setInsurers] = useState<Insurance[]>([]);

	// ---- form state
	const [editingId, setEditingId] = useState<string | null>(null);
	const [apptAt, setApptAt] = useState<string>(toDateLocalValue(new Date()));
	const [labId, setLabId] = useState<string>('');
	const [vendorId, setVendorId] = useState<string>('');              // optional now
	const [insuranceCompanyId, setInsuranceCompanyId] = useState<string>(''); // optional now

	const [clientName, setClientName] = useState('');
	const [clientRef, setClientRef] = useState('');
	const [status, setStatus] = useState<string>('TBI');
	const [visitType, setVisitType] = useState<string>('CENTER');
	const [location, setLocation] = useState('');

	const [gender, setGender] = useState<string>('');
	const [age, setAge] = useState<string>('');
	const [phone, setPhone] = useState('');
	const [serviceType, setServiceType] = useState('');
	const [paymentStatus, setPaymentStatus] = useState<string>('TBI');
	const [extraChargeRs, setExtraChargeRs] = useState<string>('');
	const [paymentDate, setPaymentDate] = useState<string>('');

	// messages
	const [formOk, setFormOk] = useState<string | null>(null);
	const [listErr, setListErr] = useState<string | null>(null);

	// REQUIRED-FIELDS MODAL
	const [reqOpen, setReqOpen] = useState(false);
	const [reqList, setReqList] = useState<string[]>([]);

	// filters
	const { from: monthFrom, to: monthTo } = getCurrentMonthBounds();
	const [q, setQ] = useState('');
	const [fDateFrom, setFDateFrom] = useState<string>(monthFrom);
	const [fDateTo, setFDateTo] = useState<string>(monthTo);
	const [fStatus, setFStatus] = useState<string>('');
	const [fLabId, setFLabId] = useState<string>(''); // empty = All Labs

	// sorting
	type TableSortKey =
		| 'date' | 'lab' | 'tpa' | 'ins' | 'client' | 'proposal'
		| 'mobile' | 'visit' | 'location' | 'status'
		| 'serviceType' | 'payment' | 'extra' | 'paymentDate'
		| 'gender' | 'age';

	const [sortKey, setSortKey] = useState<TableSortKey>('date');
	const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

	// columns
	type ColKey =
		| 'date' | 'lab' | 'tpa' | 'ins' | 'client' | 'proposal'
		| 'status' | 'visit' | 'location'
		| 'gender' | 'age' | 'mobile'
		| 'serviceType' | 'payment' | 'extra' | 'paymentDate';

	const [visibleCols, setVisibleCols] = useState<Record<ColKey, boolean>>({
		date: true,
		lab: true,
		tpa: true,
		ins: true,
		client: true,
		proposal: true,
		status: true,
		visit: true,
		location: false,
		gender: false,
		age: false,
		mobile: false,
		serviceType: false,
		payment: false,
		extra: false,
		paymentDate: false,
	});

	// dropdowns
	const [colsOpen, setColsOpen] = useState(false);
	const [rangeOpen, setRangeOpen] = useState(false);
	const colsRef = useRef<HTMLDivElement | null>(null);
	const rangeRef = useRef<HTMLDivElement | null>(null);

	// row click = edit
	const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
	const suppressVendorResetRef = useRef(false);

	// delete modal
	const [delOpen, setDelOpen] = useState(false);
	const [delLoading, setDelLoading] = useState(false);
	const [delErr, setDelErr] = useState<string | null>(null);

	useEffect(() => {
		function onDoc(e: MouseEvent) {
			const t = e.target as Node;
			if (colsRef.current && !colsRef.current.contains(t)) setColsOpen(false);
			if (rangeRef.current && !rangeRef.current.contains(t)) setRangeOpen(false);
		}
		document.addEventListener('mousedown', onDoc);
		return () => document.removeEventListener('mousedown', onDoc);
	}, []);

	const toggleCol = (k: ColKey) => setVisibleCols(v => ({ ...v, [k]: !v[k] }));

	async function load() {
		setLoading(true); setListErr(null);
		try {
			const [rVendors, rLabs, rAppts, rIns] = await Promise.all([
				fetch('/api/vendors', { cache: 'no-store' }),
				fetch('/api/labs', { cache: 'no-store' }),
				fetch('/api/appointments?status=&source=&q=', { cache: 'no-store' }),
				fetch('/api/insurance', { cache: 'no-store' }),
			]);
			const [vendorsJson, labsJson, apptsJson, insJson] = await Promise.all([
				rVendors.json().catch(() => []),
				rLabs.json().catch(() => []),
				rAppts.json().catch(() => []),
				rIns.json().catch(() => []),
			]);
			if (!rVendors.ok) throw new Error(vendorsJson?.error || 'Load vendors failed');
			if (!rLabs.ok) throw new Error(labsJson?.error || 'Load labs failed');
			if (!rAppts.ok) throw new Error(apptsJson?.error || 'Load appointments failed');
			if (!rIns.ok) throw new Error(insJson?.error || 'Load insurance failed');

			setVendors(Array.isArray(vendorsJson) ? vendorsJson : []);
			setLabs(Array.isArray(labsJson) ? labsJson : []);
			setRows(Array.isArray(apptsJson) ? apptsJson : []);
			setInsurers(Array.isArray(insJson) ? insJson : []);
		} catch (e: any) {
			setListErr(e?.message || 'Network error');
			setVendors([]); setLabs([]); setRows([]); setInsurers([]);
		} finally { setLoading(false); }
	}
	useEffect(() => { load(); }, []);

	// clear vendor only on user lab change
	useEffect(() => {
		if (suppressVendorResetRef.current) {
			suppressVendorResetRef.current = false;
			return;
		}
		setVendorId('');
	}, [labId]);

	const labVendors = useMemo(() => {
		const l = labs.find(x => x.id === labId);
		if (l?.vendors?.length) return l.vendors;
		return vendors;
	}, [labs, labId, vendors]);

	function resetForm() {
		setEditingId(null);
		setSelectedRowId(null);
		setApptAt(toDateLocalValue(new Date()));
		setLabId(''); setVendorId(''); setInsuranceCompanyId('');
		setClientName(''); setClientRef('');
		setStatus('TBI');
		setVisitType('CENTER');
		setLocation('');
		setGender('');
		setAge('');
		setPhone('');
		setServiceType('');
		setPaymentStatus('TBI');
		setExtraChargeRs('');
		setPaymentDate('');
		setFormOk(null);
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setFormOk(null);

		// Required (TPA & Insurance are OPTIONAL now)
		const missing: string[] = [];
		if (!apptAt) missing.push('Appointment Date');
		if (!labId) missing.push('Lab Name');
		if (!clientName.trim()) missing.push('Client Name');
		if (!clientRef.trim()) missing.push('Client ID / Proposal No');
		if (!gender) missing.push('Gender');
		if (!serviceType) missing.push('Service Type');
		if (!visitType) missing.push('Type of Visit');
		if (!status) missing.push('Status');
		if (!paymentStatus) missing.push('Payment Status');

		if (missing.length) {
			const ordered = ['Lab Name', 'Client Name', 'Client ID / Proposal No', 'Gender', 'Service Type'];
			const display = ordered.filter(x => missing.includes(x));
			setReqList(display);
			setReqOpen(true);
			return;
		}

		const payload = {
			apptAt,                               // backend will convert
			labId,
			vendorId: vendorId || null,           // optional
			insuranceVendorId: vendorId || null,  // legacy alias
			insuranceCompanyId: insuranceCompanyId || null, // optional

			clientName: clientName || null,
			clientRef: clientRef || null,
			gender: gender || null,
			age: age ? Number(age) : null,
			phone: phone || null,
			visitType,
			location: location || null,
			status,
			serviceType: serviceType || null,
			paymentStatus,
			extraChargeRs: extraChargeRs ? Number(extraChargeRs) : null,
			paymentDate: paymentDate ? `${paymentDate}T00:00:00` : null,
			source: 'INSURANCE',
			notes: null,
		};

		try {
			const res = await fetch(editingId ? `/api/appointments/${editingId}` : '/api/appointments', {
				method: editingId ? 'PUT' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				setReqList([data?.error || 'Save failed']);
				setReqOpen(true);
				return;
			}
			setFormOk(editingId ? 'Updated!' : 'Created!');
			await load();
			if (!editingId) resetForm();
		} catch (e: any) {
			setReqList([e?.message || 'Network error']);
			setReqOpen(true);
		}
	}

	function startEdit(a: Appointment) {
		setSelectedRowId(a.id);
		setEditingId(a.id);
		setApptAt(toDateLocalValue(a.apptAt));

		suppressVendorResetRef.current = true;
		setLabId(a.labId || '');
		setVendorId(a.vendorId || '');

		setInsuranceCompanyId(a.insuranceCompanyId || '');
		setClientName(a.clientName || '');
		setClientRef(a.clientRef || '');
		setStatus(a.status || 'TBI');
		setVisitType(a.visitType || 'CENTER');
		setLocation(a.location || '');

		setGender(a.gender || '');
		setAge(a.age != null ? String(a.age) : '');
		setPhone(a.phone || '');
		setServiceType(a.serviceType || '');
		setPaymentStatus(a.paymentStatus || 'TBI');
		setExtraChargeRs(a.extraChargeRs != null ? String(a.extraChargeRs) : '');
		setPaymentDate(formatDateOnly(a.paymentDate));
		setFormOk(null);
	}

	function inDateRangeDateOnly(apptISO: string, fromYmd: string, toYmd: string) {
		const ymd = formatDateOnly(apptISO);
		if (!ymd) return false;
		let f = fromYmd || '';
		let t = toYmd || '';
		if (f && t && f > t) [f, t] = [t, f];
		if (f && ymd < f) return false;
		if (t && ymd > t) return false;
		return true;
	}

	const getSortVal = (r: Appointment, key: any): string | number => {
		switch (key) {
			case 'date': { const ymd = formatDateOnly(r.apptAt); return ymd ? Number(ymd.replaceAll('-', '')) : 0; }
			case 'lab': { const lab = labs.find(l => l.id === r.labId); return (lab?.name || '').toLowerCase(); }
			case 'tpa': {
				const lab = labs.find(l => l.id === r.labId);
				const vendor = lab?.vendors?.find(v => v.id === r.vendorId) || vendors.find(v => v.id === r.vendorId);
				return (vendor?.tpaName || '').toLowerCase();
			}
			case 'ins': { const ins = insurers.find(i => i.id === r.insuranceCompanyId); return (ins?.name || '').toLowerCase(); }
			case 'client': return (r.clientName || '').toLowerCase();
			case 'proposal': return (r.clientRef || '').toLowerCase();
			case 'mobile': return (r.phone || '').toLowerCase();
			case 'visit': return (r.visitType || '').toLowerCase();
			case 'location': return (r.location || '').toLowerCase();
			case 'status': return (r.status || '').toLowerCase();
			case 'serviceType': return (r.serviceType || '').toLowerCase();
			case 'payment': return (r.paymentStatus || '').toLowerCase();
			case 'extra': return r.extraChargeRs ?? -1;
			case 'paymentDate': { const ymd = formatDateOnly(r.paymentDate); return ymd ? Number(ymd.replaceAll('-', '')) : 0; }
			case 'gender': return (r.gender || '').toLowerCase();
			case 'age': return r.age ?? -1;
			default: return '';
		}
	};

	const filtered = useMemo(() => {
		const term = q.trim().toLowerCase();
		const base = rows.filter(r => {
			const textOk = term
				? [r.clientName, r.clientRef, r.phone, r.location, r.serviceType].filter(Boolean)
					.some(v => String(v).toLowerCase().includes(term))
				: true;
			const dateOk = inDateRangeDateOnly(r.apptAt, fDateFrom, fDateTo);
			const stOk = fStatus ? (r.status === fStatus) : true;
			const labOk = fLabId ? (r.labId === fLabId) : true;
			return textOk && dateOk && stOk && labOk;
		});

		const sorted = [...base].sort((a, b) => {
			const va = getSortVal(a, sortKey);
			const vb = getSortVal(b, sortKey);
			if (va === vb) return 0;
			const cmp = va > vb ? 1 : -1;
			return sortDir === 'asc' ? cmp : -cmp;
		});
		return sorted;
	}, [rows, q, sortKey, sortDir, fDateFrom, fDateTo, fStatus, fLabId, labs, vendors, insurers]);

	/** Trend data (recomputes on first load + any filter change; works for All Labs) */
	const trendData = useMemo(
		() => buildTrend(rows, { labId: fLabId, from: fDateFrom, to: fDateTo }),
		[rows, fLabId, fDateFrom, fDateTo]
	);

	function sortBy(k: TableSortKey) {
		if (k === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
		else { setSortKey(k); setSortDir('asc'); }
	}

	async function onDelete() {
		if (!selectedRowId) return;
		setDelLoading(true); setDelErr(null);
		try {
			const res = await fetch(`/api/appointments/${selectedRowId}`, { method: 'DELETE' });
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.error || 'Delete failed');
			setDelOpen(false);
			setSelectedRowId(null);
			await load();
			setFormOk('Deleted');
		} catch (e: any) {
			setDelErr(e?.message || 'Network error');
		} finally {
			setDelLoading(false);
		}
	}

	const SortTh = ({ k, label, align = 'left' }: { k: TableSortKey; label: string; align?: 'left' | 'right' }) => {
		const active = sortKey === k;
		return (
			<th
				className={`px-3 py-2 text-${align} text-sm font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap`}
				onClick={() => sortBy(k)}
				title={`Sort by ${label}`}
			>
				<div className="inline-flex items-center gap-1">
					<span>{label}</span>
					{active ? (sortDir === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : null}
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

			{/* ===== FORM ===== */}
			<div className="rounded-xl border bg-white shadow-sm">
				<div className="flex items-center justify-between p-4">
					<h2 className="text-base font-semibold">{editingId ? 'Update Appointment' : 'New Appointment'}</h2>
					<button onClick={resetForm} className="text-sm text-gray-600 hover:underline">Clear</button>
				</div>

				{formOk && <div className="px-4 -mt-2 text-sm text-green-600">{formOk}</div>}

				<form onSubmit={onSubmit}>
					{/* Row 1 */}
					<div className="grid grid-cols-1 md:grid-cols-12 gap-3 px-4 pb-2">
						<div className="md:col-span-3">
							<label className="block text-sm mb-1">Appointment Date</label>
							<input
								type="datetime-local"
								value={apptAt}
								onChange={(e) => setApptAt(e.target.value)}
								className="w-full rounded px-3 py-2 border focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
							/>
						</div>
						<div className="md:col-span-3">
							<label className="block text-sm mb-1">Lab Name</label>
							<select className="w-full border rounded px-3 py-2" value={labId} onChange={(e) => setLabId(e.target.value)}>
								<option value="">Select Lab</option>
								{labs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
							</select>
						</div>
						<div className="md:col-span-3">
							<label className="block text-sm mb-1">TPA Name</label>
							<select
								className="w-full border rounded px-3 py-2"
								value={vendorId}
								onChange={(e) => setVendorId(e.target.value)}
								disabled={!labId}
							>
								<option value="">{labId ? 'Select TPA' : 'Select a Lab first'}</option>
								{(labs.find(x => x.id === labId)?.vendors?.length ? labs.find(x => x.id === labId)?.vendors! : vendors)
									.map(v => <option key={v.id} value={v.id}>{v.tpaName}</option>)}
							</select>
						</div>
						<div className="md:col-span-3">
							<label className="block text-sm mb-1">Insurance Name</label>
							<select
								className="w-full border rounded px-3 py-2"
								value={insuranceCompanyId}
								onChange={(e) => setInsuranceCompanyId(e.target.value)}
							>
								<option value="">Select Insurance</option>
								{insurers.map(ins => <option key={ins.id} value={ins.id}>{ins.name}</option>)}
							</select>
						</div>
					</div>

					{/* Row 2 */}
					<div className="grid grid-cols-1 md:grid-cols-12 gap-3 px-4 py-2">
						<div className="md:col-span-3">
							<label className="block text-sm mb-1">Client Name</label>
							<input className="w-full border rounded px-3 py-2" value={clientName} onChange={(e) => setClientName(e.target.value)} />
						</div>
						<div className="md:col-span-3">
							<label className="block text-sm mb-1">Client ID / Proposal No</label>
							<input className="w-full border rounded px-3 py-2" value={clientRef} onChange={(e) => setClientRef(e.target.value)} />
						</div>
						<div className="md:col-span-2">
							<label className="block text-sm mb-1">Status</label>
							<select className="w-full border rounded px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value)}>
								{STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
							</select>
						</div>
						<div className="md:col-span-2">
							<label htmlFor="visitType" className="block text-sm mb-1">Type of Visit</label>
							<select
								id="visitType"
								className="w-full border rounded px-3 py-2"
								value={visitType}
								onChange={(e) => setVisitType(e.target.value)}
							>
								{VISIT_TYPE_OPTS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
							</select>
						</div>
						<div className="md:col-span-2">
							<label className="block text-sm mb-1">Location</label>
							<input className="w-full border rounded px-3 py-2" value={location} onChange={(e) => setLocation(e.target.value)} />
						</div>
					</div>

					{/* Row 3 */}
					<div className="grid grid-cols-1 md:grid-cols-[130px_90px_170px_180px_160px_120px_170px] gap-3 px-4 py-2">
						<div>
							<label className="block text-sm mb-1">Gender</label>
							<select className="w-full border rounded px-3 py-2" value={gender} onChange={(e) => setGender(e.target.value)}>
								<option value="">-- Select --</option>
								{GENDER_OPTS.map(g => <option key={g} value={g}>{g}</option>)}
							</select>
						</div>
						<div>
							<label className="block text-sm mb-1">Age</label>
							<input type="number" min={0} className="w-full border rounded px-3 py-2" value={age} onChange={(e) => setAge(e.target.value)} />
						</div>
						<div>
							<label className="block text-sm mb-1">Mobile No</label>
							<input className="w-full border rounded px-3 py-2" value={phone} onChange={(e) => setPhone(e.target.value)} />
						</div>
						<div>
							<label className="block text-sm mb-1">Service Type</label>
							<select className="w-full border rounded px-3 py-2" value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
								<option value="">-- Select --</option>
								{SERVICE_TYPE_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
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
						<div>
							<label className="block text-sm mb-1">Payment Date</label>
							<input type="date" className="w-full border rounded px-3 py-2" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
						</div>
					</div>

					<div className="px-3 pb-3 py-2">
						<div className="flex gap-2">
							<button className="rounded bg-brand text-white px-4 py-2">{editingId ? 'Update' : 'Create'}</button>
							<button type="button" className="rounded border px-4 py-2" onClick={resetForm}>Reset</button>
						</div>
					</div>
				</form>
			</div>

			{/* ===== TABLE + FILTER BAR ===== */}
			<div className="rounded-xl border bg-white p-4 shadow-sm">
				{/* Filter bar */}
				<div className="rounded-l border bg-white p-4 shadow-sm">
					<div className="w-full flex flex-wrap items-end justify-center gap-3">
						{/* Search */}
						<div className="relative">
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

						{/* Lab filter */}
						<div>
							<label className="block text-xs text-gray-600 mb-1">Lab</label>
							<select
								className="border rounded px-3 py-2 min-w-[220px]"
								value={fLabId}
								onChange={(e) => setFLabId(e.target.value)}
							>
								<option value="">All Labs</option>
								{labs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
							</select>
						</div>

						{/* Date range dropdown */}
						<DateRangeDropdown
							rangeOpen={rangeOpen}
							setRangeOpen={setRangeOpen}
							fDateFrom={fDateFrom}
							fDateTo={fDateTo}
							setFDateFrom={setFDateFrom}
							setFDateTo={setFDateTo}
							rangeRef={rangeRef}
						/>

						{/* Status */}
						<div>
							<label className="block text-xs text-gray-600 mb-1">Status</label>
							<select className="border rounded px-3 py-2 min-w-[200px]" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
								<option value="">All</option>
								{STATUS_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
							</select>
						</div>

						{/* Columns dropdown */}
						<ColumnsDropdown
							colsOpen={colsOpen}
							setColsOpen={setColsOpen}
							colsRef={colsRef}
							visibleCols={visibleCols}
							toggleCol={toggleCol}
						/>
					</div>
				</div>

				{/* Table Toolbar */}
				<div className="flex items-center justify-between px-1 pb-2">
					<div className="text-sm text-gray-600">
						{selectedRowId ? '1 row selected' : ''}
					</div>
					<div className="flex items-center gap-2">
						{selectedRowId && (
							<button
								type="button"
								className="inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
								onClick={() => { setDelErr(null); setDelOpen(true); }}
								title="Delete (soft delete)"
							>
								<Trash2 className="h-4 w-4" />
								Delete
							</button>
						)}
					</div>
				</div>

				{/* Table */}
				<div className="w-full overflow-x-auto">
					<div className="max-h-[560px] overflow-y-auto">
						<table className="w-full min-w-[1200px] border rounded">
							<thead className="sticky top-0 z-10 bg-white">
								<tr>
									{visibleCols.date && <SortTh k="date" label="Date" />}
									{visibleCols.lab && <SortTh k="lab" label="Lab Name" />}
									{visibleCols.tpa && <SortTh k="tpa" label="TPA Name" />}
									{visibleCols.ins && <SortTh k="ins" label="Insurance" />}
									{visibleCols.status && <SortTh k="status" label="Status" />}
									{visibleCols.client && <SortTh k="client" label="Client Name" />}
									{visibleCols.proposal && <SortTh k="proposal" label="Proposal No" />}
									{visibleCols.mobile && <SortTh k="mobile" label="Mobile No" />}
									{visibleCols.visit && <SortTh k="visit" label="Visit" />}
									{visibleCols.location && <SortTh k="location" label="Location" />}
									{visibleCols.gender && <SortTh k="gender" label="Gender" />}
									{visibleCols.age && <SortTh k="age" label="Age" />}
									{visibleCols.serviceType && <SortTh k="serviceType" label="Service Type" />}
									{visibleCols.payment && <SortTh k="payment" label="Payment Status" />}
									{visibleCols.extra && <SortTh k="extra" label="Extra (Rs)" align="right" />}
									{visibleCols.paymentDate && <SortTh k="paymentDate" label="Payment Date" />}
								</tr>
							</thead>
							<tbody>
								{loading ? (
									<tr><td colSpan={16} className="px-3 py-4 text-center text-sm text-gray-500">Loading…</td></tr>
								) : (
									(() => {
										if (filtered.length === 0) {
											return (
												<tr>
													<td colSpan={16} className="px-3 py-4 text-center text-sm text-gray-500">
														No appointments found
													</td>
												</tr>
											);
										}
										return filtered.map((a) => {
											const lab = labs.find(l => l.id === a.labId);
											const vendor = (lab?.vendors?.find(v => v.id === a.vendorId)) || vendors.find(v => v.id === a.vendorId);
											const ins = insurers.find(i => i.id === a.insuranceCompanyId);
											const selected = selectedRowId === a.id;
											let visitTypeLabel = '';
											if (a.visitType === 'CENTER') visitTypeLabel = 'Center';
											else if (a.visitType === 'HOME') visitTypeLabel = 'Home';

											return (
												<tr
													key={a.id}
													className={`border-t hover:bg-gray-50 ${selected ? 'bg-brand/5' : ''} cursor-pointer`}
													onClick={() => startEdit(a)}
													title="Click row to edit"
													onMouseDown={() => setSelectedRowId(a.id)}
												>
													{visibleCols.date && <td className="px-3 py-2 text-sm whitespace-nowrap">{formatDateOnly(a.apptAt)}</td>}
													{visibleCols.lab && <td className="px-3 py-2 text-sm">{lab?.nickName ?? ''}</td>}
													{visibleCols.tpa && <td className="px-3 py-2 text-sm">{vendor?.tpaName ?? ''}</td>}
													{visibleCols.ins && <td className="px-3 py-2 text-sm">{ins?.nickName ?? ''}</td>}
													{visibleCols.status && (
														<td className="px-3 py-2 text-sm whitespace-nowrap">
															<span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${statusClasses(a.status)}`}>{a.status ?? ''}</span>
														</td>
													)}
													{visibleCols.client && <td className="px-3 py-2 text-sm">{a.clientName ?? ''}</td>}
													{visibleCols.proposal && <td className="px-3 py-2 text-sm">{a.clientRef ?? ''}</td>}
													{visibleCols.mobile && <td className="px-3 py-2 text-sm whitespace-nowrap">{a.phone ?? ''}</td>}
													{visibleCols.visit && <td className="px-3 py-2 text-sm">{visitTypeLabel}</td>}
													{visibleCols.location && <td className="px-3 py-2 text-sm">{a.location ?? ''}</td>}
													{visibleCols.gender && <td className="px-3 py-2 text-sm">{a.gender ?? ''}</td>}
													{visibleCols.age && <td className="px-3 py-2 text-sm">{a.age ?? ''}</td>}
													{visibleCols.serviceType && <td className="px-3 py-2 text-sm">{a.serviceType ?? ''}</td>}
													{visibleCols.payment && <td className="px-3 py-2 text-sm whitespace-nowrap">{a.paymentStatus ?? ''}</td>}
													{visibleCols.extra && <td className="px-3 py-2 text-sm text-right">{a.extraChargeRs ?? ''}</td>}
													{visibleCols.paymentDate && <td className="px-3 py-2 text-sm whitespace-nowrap">{formatDateOnly(a.paymentDate)}</td>}
												</tr>
											);
										});
									})()
								)}
							</tbody>
						</table>
					</div>
				</div>

				{listErr && <div className="mt-3 text-sm text-red-600">{listErr}</div>}
			</div>

			{/* Delete confirm modal */}
			{delOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
					<div className="bg-white rounded-xl shadow-lg w-full max-w-md">
						<div className="flex items-center justify-between p-3 border-b">
							<h3 className="font-semibold inline-flex items-center gap-2">
								<AlertTriangle className="h-4 w-4 text-red-600" />
								Delete Appointment
							</h3>
							<button className="p-1 rounded hover:bg-gray-100" onClick={() => setDelOpen(false)}><X className="h-5 w-5" /></button>
						</div>
						<div className="p-4 text-sm">
							{delErr && <div className="mb-2 text-red-600">{delErr}</div>}
							Are you sure you want to delete this appointment? This will mark it as <b>inactive</b>.
						</div>
						<div className="p-3 border-t flex justify-end gap-2">
							<button className="rounded border px-3 py-1.5" onClick={() => setDelOpen(false)} disabled={delLoading}>Cancel</button>
							<button
								className="rounded bg-red-600 text-white px-3 py-1.5 disabled:opacity-60"
								onClick={onDelete}
								disabled={delLoading}
							>
								{delLoading ? 'Deleting…' : 'Delete'}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Required fields modal */}
			{reqOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
					<div className="bg-white rounded-xl shadow-lg w-full max-w-lg">
						<div className="flex items-center justify-between p-3 border-b">
							<h3 className="font-semibold inline-flex items-center gap-2">
								<Info className="h-4 w-4 text-brand-600" />
								Missing Information
							</h3>
							<button className="p-1 rounded hover:bg-gray-100" onClick={() => setReqOpen(false)}>
								<X className="h-5 w-5" />
							</button>
						</div>
						<div className="p-4 text-sm leading-relaxed">
							{reqList.length > 0
								? <span>Please fill required fields: <b>{reqList.join(', ')}</b>.</span>
								: <span>Please fill required fields.</span>}
						</div>
						<div className="p-3 border-t flex justify-end">
							<button className="rounded bg-brand text-white px-4 py-1.5" onClick={() => setReqOpen(false)}>OK</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

/* ---------- Small subcomponents ---------- */

function DateRangeDropdown({
	rangeOpen, setRangeOpen,
	fDateFrom, fDateTo, setFDateFrom, setFDateTo,
	rangeRef,
}: Readonly<{
	rangeOpen: boolean;
	setRangeOpen: (v: boolean) => void;
	fDateFrom: string;
	fDateTo: string;
	setFDateFrom: (v: string) => void;
	setFDateTo: (v: string) => void;
	rangeRef: React.RefObject<HTMLDivElement>;
}>) {
	let rangeLabel = '';
	if (!fDateFrom && !fDateTo) {
		rangeLabel = 'All dates';
	} else if (fDateFrom && fDateTo) {
		rangeLabel = `${fDateFrom} → ${fDateTo}`;
	} else if (fDateFrom) {
		rangeLabel = `${fDateFrom} → …`;
	} else {
		rangeLabel = `… → ${fDateTo}`;
	}

	return (
		<div ref={rangeRef} className="relative">
			<label className="block text-xs text-gray-600 mb-1">Date range</label>
			<button
				type="button"
				onClick={() => setRangeOpen(!rangeOpen)}
				className="inline-flex items-center gap-2 border rounded px-3 py-2"
				title="Choose date range"
			>
				<SlidersHorizontal className="h-4 w-4" />
				<span className="text-sm">{rangeLabel}</span>
				<ChevronDown className="h-4 w-4 opacity-70" />
			</button>

			{rangeOpen && (
				<div className="absolute z-20 mt-1 w-[320px] rounded border bg-white shadow p-3 right-0">
					<div className="grid grid-cols-1 gap-2">
						<div>
							<label className="block text-xs text-gray-600 mb-1">From</label>
							<input type="date" className="w-full border rounded px-3 py-2" value={fDateFrom} onChange={(e) => setFDateFrom(e.target.value)} />
						</div>
						<div>
							<label className="block text-xs text-gray-600 mb-1">To</label>
							<input type="date" className="w-full border rounded px-3 py-2" value={fDateTo} onChange={(e) => setFDateTo(e.target.value)} />
						</div>
						<div className="flex gap-2 pt-1">
							<button
								type="button"
								className="border rounded px-3 py-1.5 text-sm"
								onClick={() => { setFDateFrom(''); setFDateTo(''); setRangeOpen(false); }}
							>
								Clear
							</button>
							<button
								type="button"
								className="ml-auto bg-brand text-white rounded px-3 py-1.5 text-sm"
								onClick={() => setRangeOpen(false)}
							>
								Apply
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function ColumnsDropdown({
	colsOpen, setColsOpen, colsRef, visibleCols, toggleCol,
}: Readonly<{
	colsOpen: boolean;
	setColsOpen: (v: boolean) => void;
	colsRef: React.RefObject<HTMLDivElement>;
	visibleCols: Record<'date' | 'lab' | 'tpa' | 'ins' | 'client' | 'proposal' | 'mobile' | 'visit' | 'location' | 'status' | 'extra' | 'payment' | 'gender' | 'age' | 'serviceType' | 'paymentDate', boolean>;
	toggleCol: (k: any) => void;
}>) {
	const items: [keyof typeof visibleCols, string][] = [
		['date', 'Date'], ['lab', 'Lab'], ['tpa', 'TPA'], ['ins', 'Insurance'],
		['client', 'Client'], ['proposal', 'Proposal No'], ['status', 'Status'],
		['visit', 'Visit Type'], ['location', 'Location'],
		['gender', 'Gender'], ['age', 'Age'], ['mobile', 'Mobile'],
		['serviceType', 'Service Type'], ['payment', 'Payment Status'],
		['extra', 'Extra Rs'], ['paymentDate', 'Payment Date'],
	];
	return (
		<div ref={colsRef} className="relative">
			<label className="block text-xs text-gray-600 mb-1 invisible">Columns</label>
			<button
				type="button"
				onClick={() => setColsOpen(!colsOpen)}
				className="inline-flex items-center gap-2 border rounded px-3 py-2"
				title="Show/Hide columns"
			>
				Select Columns
				<ChevronDown className="h-4 w-4 opacity-70" />
			</button>

			{colsOpen && (
				<div className="absolute right-0 z-20 mt-1 w-[300px] rounded border bg-white shadow p-2">
					<div className="grid grid-cols-2 gap-1 text-sm">
						{items.map(([k, label]) => (
							<label key={k} className="inline-flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-50 cursor-pointer">
								<input type="checkbox" checked={visibleCols[k]} onChange={() => toggleCol(k)} />
								{label}
							</label>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
