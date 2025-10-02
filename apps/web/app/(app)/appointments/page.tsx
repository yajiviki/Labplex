'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
	CalendarPlus, Search, ChevronDown, ChevronUp, SlidersHorizontal
} from 'lucide-react';

type Vendor = { id: string; vendorId: string; tpaName: string };
type Lab = {
	id: string;
	labCode: string;
	name: string;
	vendors?: Vendor[];
};
type Insurance = { id: string; code: string | null; name: string; address: string | null };

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
	address: string | null;
	phone: string | null;
	visitType: string | null; // CENTER | HOME
	location: string | null;
	status: string | null;
	extraChargeRs: number | null;
	paymentStatus: string | null;
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

// Helpers
function toDateLocalValue(d?: string | Date | null) {
	if (!d) return '';
	const dt = typeof d === 'string' ? new Date(d.includes('T') ? d : d.replace(' ', 'T')) : d;
	const pad = (n: number) => String(n).padStart(2, '0');
	const yyyy = dt.getFullYear();
	const mm = pad(dt.getMonth() + 1);
	const dd = pad(dt.getDate());
	const hh = pad(dt.getHours());
	const mi = pad(dt.getMinutes());
	return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}
function fromDateLocalValue(v: string) { return v ? new Date(v).toISOString() : null; }



function formatDateOnly(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return '';

	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0'); // 01–12
	const day = String(d.getDate()).padStart(2, '0');        // 01–31

	return `${year}-${month}-${day}`;
}

// function formatDateOnly(iso: string): string {
// 	return apptYMD(iso) || '';
// }

// current month start/end (yyyy-mm-dd)
function getCurrentMonthBounds() {
	const pad = (n: number) => String(n).padStart(2, '0');
	const now = new Date();
	const start = new Date(now.getFullYear(), now.getMonth(), 1);
	const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
	const from = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;
	const to = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`;
	return { from, to };
}

// --- Status chip styling map ---
function statusClasses(s?: string | null) {
	const key = (s || '').trim().toLowerCase();
	switch (key) {
		case 'tbi':
			return 'bg-purple-100 text-purple-800';
		case 'on hold':
		case 'not responding':
			return 'bg-yellow-100 text-yellow-800';
		case 'waiting for response':
			return 'bg-gray-100 text-gray-800';
		case 'rescheduled':
			return 'bg-red-100 text-red-800';
		case 'need confirmation':
			return 'bg-slate-200 text-slate-900';
		case 'sample collected':
			return 'bg-orange-100 text-orange-800';
		case 'medical done':
			return 'bg-blue-100 text-blue-800';
		case 'cancelled':
			return 'bg-blue-200 text-blue-900';
		case 'onprogress':
			return 'bg-yellow-200 text-black-900';
		case 'completed':
			return 'bg-green-100 text-green-800';
		case 'submitted':
			return 'bg-green-100 text-green-800';
		default:
			return 'bg-gray-100 text-gray-800';
	}
}

export default function AppointmentsPage() {
	const [loading, setLoading] = useState(false);
	const [rows, setRows] = useState<Appointment[]>([]);
	const [vendors, setVendors] = useState<Vendor[]>([]);
	const [labs, setLabs] = useState<Lab[]>([]);
	const [insurers, setInsurers] = useState<Insurance[]>([]);

	// form
	const [editingId, setEditingId] = useState<string | null>(null);
	const [apptAt, setApptAt] = useState<string>(toDateLocalValue(new Date()));
	const [labId, setLabId] = useState<string>('');
	const [vendorId, setVendorId] = useState<string>('');
	const [insuranceCompanyId, setInsuranceCompanyId] = useState<string>('');
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
	const [paymentStatus, setPaymentStatus] = useState<string>('TBI');

	// messages
	const [formErr, setFormErr] = useState<string | null>(null);
	const [formOk, setFormOk] = useState<string | null>(null);
	const [listErr, setListErr] = useState<string | null>(null);

	// filters
	const { from: monthFrom, to: monthTo } = getCurrentMonthBounds();
	const [q, setQ] = useState('');
	const [fDateFrom, setFDateFrom] = useState<string>(monthFrom);
	const [fDateTo, setFDateTo] = useState<string>(monthTo);
	const [fStatus, setFStatus] = useState<string>('');
	const [fLabId, setFLabId] = useState<string>('');

	// sorting
	type TableSortKey =
		| 'date' | 'lab' | 'tpa' | 'ins' | 'client' | 'proposal'
		| 'mobile' | 'visit' | 'location' | 'status' | 'extra' | 'payment';

	const [sortKey, setSortKey] = useState<TableSortKey>('date');
	const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

	// columns
	type ColKey =
		| 'date' | 'lab' | 'tpa' | 'ins' | 'client' | 'proposal'
		| 'mobile' | 'visit' | 'location' | 'status' | 'extra' | 'payment';

	const [visibleCols, setVisibleCols] = useState<Record<ColKey, boolean>>({
		date: true,
		lab: true,
		tpa: true,
		ins: true,
		client: true,
		proposal: true,
		visit: true,
		location: true,
		status: true,
		mobile: false,
		extra: false,
		payment: false,
	});

	// dropdowns
	const [colsOpen, setColsOpen] = useState(false);
	const [rangeOpen, setRangeOpen] = useState(false);
	const colsRef = useRef<HTMLDivElement | null>(null);
	const rangeRef = useRef<HTMLDivElement | null>(null);

	// row click = edit
	const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
	const suppressVendorResetRef = useRef(false);

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
		setGender(''); setAge(''); setAddress(''); setPhone('');
		setVisitType('CENTER'); setLocation('');
		setStatus('TBI'); setExtraChargeRs(''); setPaymentStatus('TBI');
		setFormErr(null); setFormOk(null);
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setFormErr(null); setFormOk(null);

		if (!apptAt) return setFormErr('Appointment Date is required');
		if (!visitType) return setFormErr('Type of Visit is required');
		if (!labId) return setFormErr('Lab Name is required');
		if (!vendorId) return setFormErr('TPA Name is required');
		if (!insuranceCompanyId) return setFormErr('Insurance name is required');
		if (!clientName.trim()) return setFormErr('Client Name is required');
		if (!status) return setFormErr('Status is required');
		if (!paymentStatus) return setFormErr('Payment Status is required');

		const payload = {
			apptAt: formatDateOnly(apptAt),
			labId,
			vendorId,
			insuranceVendorId: vendorId,
			insuranceCompanyId,
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
			notes: null,
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
		setSelectedRowId(a.id);
		setEditingId(a.id);
		setApptAt(toDateLocalValue(a.apptAt));

		suppressVendorResetRef.current = true;
		setLabId(a.labId || '');
		setVendorId(a.vendorId || '');

		setInsuranceCompanyId(a.insuranceCompanyId || '');
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
		setPaymentStatus(a.paymentStatus || 'TBI');
		setFormErr(null); setFormOk(null);
	}

	/** Date-only range check using normalized YYYY-MM-DD */
	function inDateRangeDateOnly(apptISO: string, fromYmd: string, toYmd: string) {
		const ymd = formatDateOnly(apptISO);
		if (!ymd) return false;
		let f = fromYmd || '';
		let t = toYmd || '';
		if (f && t && f > t) [f, t] = [t, f]; // auto-correct inverted range
		if (f && ymd < f) return false;
		if (t && ymd > t) return false;
		return true;
	}

	// value getter for sorting across all columns
	const getSortVal = (r: Appointment, key: TableSortKey): string | number => {
		switch (key) {
			case 'date': {
				const ymd = formatDateOnly(r.apptAt);                 // "2025-09-01"
				return ymd ? Number(ymd.replaceAll('-', '')) : 0; // 20250901
			}

			case 'lab': {
				const lab = labs.find(l => l.id === r.labId);
				return (lab?.name || '').toLowerCase();
			}
			case 'tpa': {
				const lab = labs.find(l => l.id === r.labId);
				const vendor = lab?.vendors?.find(v => v.id === r.vendorId) || vendors.find(v => v.id === r.vendorId);
				return (vendor?.tpaName || '').toLowerCase();
			}
			case 'ins': {
				const ins = insurers.find(i => i.id === r.insuranceCompanyId);
				return (ins?.name || '').toLowerCase();
			}
			case 'client': return (r.clientName || '').toLowerCase();
			case 'proposal': return (r.clientRef || '').toLowerCase();
			case 'mobile': return (r.phone || '').toLowerCase();
			case 'visit': return (r.visitType || '').toLowerCase();
			case 'location': return (r.location || '').toLowerCase();
			case 'status': return (r.status || '').toLowerCase();
			case 'extra': return r.extraChargeRs ?? -1;
			case 'payment': return (r.paymentStatus || '').toLowerCase();
			default: return '';
		}
	};

	const filtered = useMemo(() => {
		const term = q.trim().toLowerCase();
		const base = rows.filter(r => {
			const textOk = term
				? [r.clientName, r.clientRef, r.phone, r.location]
					.filter(Boolean)
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

	function sortBy(k: TableSortKey) {
		if (k === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
		else { setSortKey(k); setSortDir('asc'); }
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

			{/* FORM */}
			<div className="rounded-xl border bg-white p-4 shadow-sm">
				<div className="flex items-center justify-between mb-3">
					<h2 className="text-base font-semibold">{editingId ? 'Update Appointment' : 'Add New Appointment'}</h2>
					<button onClick={resetForm} className="text-sm text-gray-600 hover:underline">Clear</button>
				</div>

				{formErr && <div className="mb-3 text-sm text-red-600">{formErr}</div>}
				{formOk && <div className="mb-3 text-sm text-green-600">{formOk}</div>}

				<form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-3">
					{/* Row 1 */}
					<div>
						<label className="block text-sm mb-1">Appointment Date</label>
						<input
							type="datetime-local"
							value={apptAt}
							onChange={(e) => setApptAt(e.target.value)}
							className="w-full rounded px-3 py-2 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
						/>
					</div>
					<div>
						<label className="block text-sm mb-1">Type of Visit</label>
						<select className="w-full border rounded px-3 py-2" value={visitType} onChange={(e) => setVisitType(e.target.value)}>
							{VISIT_TYPE_OPTS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
						</select>
					</div>
					<div>
						<label className="block text-sm mb-1">Lab Name</label>
						<select className="w-full border rounded px-3 py-2" value={labId} onChange={(e) => setLabId(e.target.value)}>
							<option value="">Select Lab</option>
							{labs.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
						</select>
					</div>
					<div>
						<label className="block text-sm mb-1">TPA Name</label>
						<select
							className="w-full border rounded px-3 py-2"
							value={vendorId}
							onChange={(e) => setVendorId(e.target.value)}
							disabled={!labId}
						>
							<option value="">{labId ? 'Select TPA' : 'Select a Lab first'}</option>
							{labVendors.map(v => <option key={v.id} value={v.id}>{v.tpaName}</option>)}
						</select>
					</div>
					<div>
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

					{/* Row 2 */}
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

					{/* Row 3 */}
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

			{/* TABLE + FILTER BAR */}
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

				{/* Table */}
				<div className="w-full overflow-x-auto">
					<div className="max-h-[560px] overflow-y-auto">
						<table className="w-full min-w-[1200px] border rounded">
							<thead className="sticky top-0 z-10">
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
									{visibleCols.extra && <SortTh k="extra" label="Extra (Rs)" align="right" />}
									{visibleCols.payment && <SortTh k="payment" label="Payment Status" />}
								</tr>
							</thead>
							<tbody>
								{loading ? (
									<tr><td colSpan={12} className="px-3 py-4 text-center text-sm text-gray-500">Loading…</td></tr>
								) : filtered.length === 0 ? (
									<tr><td colSpan={12} className="px-3 py-4 text-center text-sm text-gray-500">No appointments found</td></tr>
								) : (
									filtered.map((a) => {
										const lab = labs.find(l => l.id === a.labId);
										const vendor = (lab?.vendors?.find(v => v.id === a.vendorId)) || vendors.find(v => v.id === a.vendorId);
										const ins = insurers.find(i => i.id === a.insuranceCompanyId);
										const selected = selectedRowId === a.id;

										return (
											<tr
												key={a.id}
												className={`border-t hover:bg-gray-50 ${selected ? 'bg-brand/5' : ''} cursor-pointer`}
												onClick={() => startEdit(a)}
												title="Click row to edit"
											>
												{visibleCols.date && (
													<td className="px-3 py-2 text-sm whitespace-nowrap">{formatDateOnly(a.apptAt)}</td>
												)}
												{visibleCols.lab && <td className="px-3 py-2 text-sm">{lab?.name ?? ''}</td>}
												{visibleCols.tpa && <td className="px-3 py-2 text-sm">{vendor?.tpaName ?? ''}</td>}
												{visibleCols.ins && <td className="px-3 py-2 text-sm">{ins?.address ?? ''}</td>}
												{visibleCols.status && (
													<td className="px-3 py-2 text-sm whitespace-nowrap">
														<span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${statusClasses(a.status)}`}>
															{a.status ?? ''}
														</span>
													</td>
												)}
												{visibleCols.client && <td className="px-3 py-2 text-sm">{a.clientName ?? ''}</td>}
												{visibleCols.proposal && <td className="px-3 py-2 text-sm">{a.clientRef ?? ''}</td>}
												{visibleCols.mobile && <td className="px-3 py-2 text-sm whitespace-nowrap">{a.phone ?? ''}</td>}
												{visibleCols.visit && (
													<td className="px-3 py-2 text-sm">
														{a.visitType === 'CENTER' ? 'Center' : a.visitType === 'HOME' ? 'Home' : ''}
													</td>
												)}
												{visibleCols.location && <td className="px-3 py-2 text-sm">{a.location ?? ''}</td>}
												{visibleCols.extra && <td className="px-3 py-2 text-sm text-right">{a.extraChargeRs ?? ''}</td>}
												{visibleCols.payment && <td className="px-3 py-2 text-sm whitespace-nowrap">{a.paymentStatus ?? ''}</td>}
											</tr>
										);
									})
								)}
							</tbody>
						</table>
					</div>
				</div>

				{listErr && <div className="mt-3 text-sm text-red-600">{listErr}</div>}
			</div>
		</div>
	);
}

/* ---------- Small subcomponents ---------- */

function DateRangeDropdown({
	rangeOpen, setRangeOpen,
	fDateFrom, fDateTo, setFDateFrom, setFDateTo,
	rangeRef,
}: {
	rangeOpen: boolean;
	setRangeOpen: (v: boolean) => void;
	fDateFrom: string;
	fDateTo: string;
	setFDateFrom: (v: string) => void;
	setFDateTo: (v: string) => void;
	rangeRef: React.RefObject<HTMLDivElement>;
}) {
	const rangeLabel = (!fDateFrom && !fDateTo)
		? 'All dates'
		: (fDateFrom && fDateTo) ? `${fDateFrom} → ${fDateTo}`
			: fDateFrom ? `${fDateFrom} → …` : `… → ${fDateTo}`;

	return (
		<div ref={rangeRef} className="relative">
			<label className="block text-xs text-gray-600 mb-1">Date range</label>
			<button
				type="button"
				onClick={() => setRangeOpen(v => !v)}
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
							<input
								type="date"
								className="w-full border rounded px-3 py-2"
								value={fDateFrom}
								onChange={(e) => setFDateFrom(e.target.value)}
							/>
						</div>
						<div>
							<label className="block text-xs text-gray-600 mb-1">To</label>
							<input
								type="date"
								className="w-full border rounded px-3 py-2"
								value={fDateTo}
								onChange={(e) => setFDateTo(e.target.value)}
							/>
						</div>
						<div className="flex gap-2 pt-1">
							<button
								type="button"
								className="border rounded px-3 py-1.5 text-sm"
								onClick={() => { /* Clear to all dates, or switch to month defaults if you prefer */
									setFDateFrom(''); setFDateTo(''); setRangeOpen(false);
								}}
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
}: {
	colsOpen: boolean;
	setColsOpen: (v: boolean) => void;
	colsRef: React.RefObject<HTMLDivElement>;
	visibleCols: Record<'date' | 'lab' | 'tpa' | 'ins' | 'client' | 'proposal' | 'mobile' | 'visit' | 'location' | 'status' | 'extra' | 'payment', boolean>;
	toggleCol: (k: any) => void;
}) {
	const items: [keyof typeof visibleCols, string][] = [
		['date', 'Date'], ['lab', 'Lab'], ['tpa', 'TPA'], ['ins', 'Insurance'], ['client', 'Client'],
		['proposal', 'Proposal No'], ['mobile', 'Mobile'], ['visit', 'Visit Type'],
		['location', 'Location'], ['status', 'Status'], ['extra', 'Extra Rs'], ['payment', 'Payment'],
	];
	return (
		<div ref={colsRef} className="relative">
			<label className="block text-xs text-gray-600 mb-1 invisible">Columns</label>
			<button
				type="button"
				onClick={() => setColsOpen(v => !v)}
				className="inline-flex items-center gap-2 border rounded px-3 py-2"
				title="Show/Hide columns"
			>
				Select Columns
				<ChevronDown className="h-4 w-4 opacity-70" />
			</button>

			{colsOpen && (
				<div className="absolute right-0 z-20 mt-1 w-[280px] rounded border bg-white shadow p-2">
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
