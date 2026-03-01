'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
	CalendarPlus, Search, ChevronDown, ChevronUp, SlidersHorizontal,
	Trash2, X, AlertTriangle, Info, FileDown
} from 'lucide-react';
import {
	ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip,
} from 'recharts';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

	serviceType: string | null;
	paymentStatus: string | null;
	extraChargeRs: number | null;
	paymentDate: string | null;

	createdAt: string;

	// tests (should be returned by /api/appointments)
	bloodTest?: 'FB' | 'B' | 'No' | null;
	urineTest?: boolean | 'Yes' | 'No' | null;
	ecg?: boolean | 'Yes' | 'No' | null;
	tmt?: boolean | 'Yes' | 'No' | null;
	applicationForm?: 'MER' | 'FMR' | 'ALL' | null;
	testSummary?: string;
};

const GENDER_OPTS = ['Male', 'Female'] as const;
const VISIT_TYPE_OPTS = [
	{ value: 'CENTER', label: 'Center' },
	{ value: 'HOME', label: 'Home' },
] as const;
const STATUS_OPTS = [
	'TBI', 'Not Responding', 'Rescheduled', 'Need Confirmation', 'Confirmed',
	'Medical Done', 'Cancelled', 'Report - InProgress', 'Report - Completed'
] as const;
const PAYMENT_STATUS_OPTS = ['TBI', 'Paid', 'On Account'] as const;
const SERVICE_TYPE_OPTS = ['Local', 'Outer', 'Others'] as const;

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
		case 'appointment confirmed':
		case 'confirmed': return 'bg-cyan-100 text-cyan-800';
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
		if (opts.labId && r.labId !== opts.labId) continue;
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

/** Build a single code like "FB,U,ECG,TMT,MER" from the test fields */
function formatTestCodes(a: Appointment): string {
	const parts: string[] = [];
	if (a.bloodTest === 'FB') parts.push('FB');
	else if (a.bloodTest === 'B') parts.push('B');

	if (a.urineTest === true || a.urineTest === 'Yes') parts.push('U');
	if (a.ecg === true || a.ecg === 'Yes') parts.push('ECG');
	if ((a as any).tmt === true || (a as any).tmt === 'Yes') parts.push('TMT');

	if (a.applicationForm === 'MER' || a.applicationForm === 'FMR' || a.applicationForm === 'ALL') {
		parts.push(a.applicationForm);
	}
	return parts.join(',');
}

/* ========= Small UI bits ========= */

function Pill({
	active,
	children,
	onClick,
}: Readonly<{
	active: boolean;
	children: React.ReactNode;
	onClick: () => void;
}>) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={[
				'px-3 py-1.5 rounded-full border text-sm transition',
				active ? 'bg-brand text-white border-brand' : 'bg-white hover:bg-gray-50',
			].join(' ')}
		>
			{children}
		</button>
	);
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

	const extraRef = useRef<HTMLInputElement | null>(null);

	// Tests dialog state
	const [testsOpen, setTestsOpen] = useState(false);
	const [bloodTest, setBloodTest] = useState<'FB' | 'B' | 'No'>('No');
	const [urineTest, setUrineTest] = useState<'Yes' | 'No'>('No');
	const [ecg, setEcg] = useState<'Yes' | 'No'>('No');
	const [tmt, setTmt] = useState<'Yes' | 'No'>('No');
	const [applicationForm, setApplicationForm] = useState<'MER' | 'FMR'>('MER');

	const [pendingCreate, setPendingCreate] = useState(false);

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

	// ✅ Filters
	const [fTpaId, setFTpaId] = useState<string>('');           // TPA
	const [fVisitType, setFVisitType] = useState<string>('');   // Visit Type
	const [fServiceType, setFServiceType] = useState<string>(''); // ✅ replaced Location filter

	// sorting
	type TableSortKey =
		| 'date' | 'lab' | 'tpa' | 'ins' | 'client' | 'proposal'
		| 'mobile' | 'visit' | 'location' | 'status'
		| 'serviceType' | 'payment' | 'extra' | 'paymentDate'
		| 'gender' | 'age'
		| 'tests';

	const [sortKey, setSortKey] = useState<TableSortKey>('date');
	const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

	// columns
	type ColKey =
		| 'date' | 'lab' | 'tpa' | 'ins' | 'client' | 'proposal'
		| 'status' | 'visit' | 'location'
		| 'gender' | 'age' | 'mobile'
		| 'serviceType' | 'payment' | 'extra' | 'paymentDate'
		| 'tests';

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
		tests: false,
	});

	const visibleColCount = useMemo(
		() => Object.values(visibleCols).filter(Boolean).length,
		[visibleCols]
	);

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
			if (!rVendors.ok) throw new Error((vendorsJson as any)?.error || 'Load vendors failed');
			if (!rLabs.ok) throw new Error((labsJson as any)?.error || 'Load labs failed');
			if (!rAppts.ok) throw new Error((apptsJson as any)?.error || 'Load appointments failed');
			if (!rIns.ok) throw new Error((insJson as any)?.error || 'Load insurance failed');

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

	// focus Extra when Outer and empty
	useEffect(() => {
		const isOuter = (serviceType || '').trim().toLowerCase() === 'outer';
		const extraEmpty = !extraChargeRs || Number(extraChargeRs) <= 0;
		if (isOuter && extraEmpty) setTimeout(() => extraRef.current?.focus(), 0);
	}, [serviceType, extraChargeRs]);

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

		setBloodTest('No');
		setUrineTest('No');
		setEcg('No');
		setTmt('No');
		setApplicationForm('MER');

		setPendingCreate(false);
	}

	function validateRequiredFields(): string[] {
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

		const isOuter = (serviceType || '').trim().toLowerCase() === 'outer';
		const extraNum = extraChargeRs === '' ? NaN : Number(extraChargeRs);
		const extraValid = Number.isFinite(extraNum) && extraNum > 0;
		if (isOuter && !extraValid) missing.push('Extra Charge (Rs)');

		return missing;
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setFormOk(null);

		const missing = validateRequiredFields();
		if (missing.length) {
			const ordered = [
				'Lab Name',
				'Client Name',
				'Client ID / Proposal No',
				'Gender',
				'Service Type',
				'Extra Charge (Rs)',
			];
			const display = ordered.filter(x => missing.includes(x));
			setReqList(display.length ? display : missing);
			setReqOpen(true);
			if (missing.includes('Extra Charge (Rs)')) setTimeout(() => extraRef.current?.focus(), 0);
			return;
		}

		if (!editingId) {
			setPendingCreate(true);
			setTestsOpen(true);
			return;
		}

		const payload = {
			apptAt,
			labId,
			vendorId: vendorId || null,
			insuranceVendorId: vendorId || null,
			insuranceCompanyId: insuranceCompanyId || null,

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
			const res = await fetch(`/api/appointments/${editingId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				setReqList([(data as any)?.error || 'Save failed']);
				setReqOpen(true);
				return;
			}
			setFormOk('Updated!');
			await load();
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

		setBloodTest((a.bloodTest as any) ?? 'No');
		setUrineTest((a.urineTest === true || a.urineTest === 'Yes') ? 'Yes' : 'No');
		setEcg((a.ecg === true || a.ecg === 'Yes') ? 'Yes' : 'No');
		setTmt((a.tmt === true || a.tmt === 'Yes') ? 'Yes' : 'No');
		setApplicationForm((a.applicationForm as any) ?? 'MER');

		setPendingCreate(false);
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
			case 'tests': return formatTestCodes(r).toLowerCase();
			default: return '';
		}
	};

	// ✅ Filters (searchbox ONLY: client/proposal/mobile) + new filters (TPA, VisitType, ServiceType)
	const filtered = useMemo(() => {
		const term = q.trim().toLowerCase();

		const base = rows.filter(r => {
			const dateOk = inDateRangeDateOnly(r.apptAt, fDateFrom, fDateTo);
			const stOk = fStatus ? (r.status === fStatus) : true;
			const labOk = fLabId ? (r.labId === fLabId) : true;

			const tpaOk = fTpaId ? (r.vendorId === fTpaId) : true;
			const visitOk = fVisitType ? ((r.visitType || '') === fVisitType) : true;

			const svcOk = fServiceType
				? String(r.serviceType || '').trim().toLowerCase() === fServiceType.trim().toLowerCase()
				: true;

			if (!(dateOk && stOk && labOk && tpaOk && visitOk && svcOk)) return false;

			if (!term) return true;
			const haystack = [r.clientName, r.clientRef, r.phone]
				.filter(Boolean)
				.map(s => String(s).toLowerCase());
			return haystack.some(s => s.includes(term));
		});

		const sorted = [...base].sort((a, b) => {
			const va = getSortVal(a, sortKey);
			const vb = getSortVal(b, sortKey);
			if (va === vb) return 0;
			const cmp = va > vb ? 1 : -1;
			return sortDir === 'asc' ? cmp : -cmp;
		});

		return sorted;
	}, [
		rows, q,
		sortKey, sortDir,
		fDateFrom, fDateTo, fStatus, fLabId,
		fTpaId, fVisitType, fServiceType,
		labs, vendors, insurers
	]);

	// ✅ Total Extra for footer
	const extraTotal = useMemo(() => {
		return filtered.reduce((sum, r) => sum + (Number(r.extraChargeRs) || 0), 0);
	}, [filtered]);

	/** Trend data */
	const trendData = useMemo(
		() => buildTrend(rows, { labId: fLabId, from: fDateFrom, to: fDateTo }),
		[rows, fLabId, fDateFrom, fDateTo]
	);

	function sortBy(k: TableSortKey) {
		if (k === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
		else { setSortKey(k); setSortDir('asc'); }
	}

	// ✅ Export PDF using jsPDF (no print dialog)
	function exportFilteredToPdf(rowsToExport: Appointment[]) {
		const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

		const labName = fLabId ? (labs.find(l => l.id === fLabId)?.name || '') : 'All Labs';
		const statusText = fStatus || 'All';
		const dateText = (fDateFrom || fDateTo) ? `${fDateFrom || '…'} → ${fDateTo || '…'}` : 'All dates';
		const searchText = q.trim() || '—';

		const tpaName = fTpaId ? (vendors.find(v => v.id === fTpaId)?.tpaName || '') : 'All';
		const visitText = fVisitType ? (fVisitType === 'CENTER' ? 'Center' : 'Home') : 'All';
		const svcText = fServiceType || 'All';

		doc.setFontSize(14);
		doc.text('Appointments (Filtered)', 40, 40);

		doc.setFontSize(10);
		doc.text(`Date range: ${dateText}`, 40, 60);
		doc.text(`Lab: ${labName}    Status: ${statusText}`, 40, 75);
		doc.text(`TPA: ${tpaName}    Visit: ${visitText}    Service Type: ${svcText}`, 40, 90);
		doc.text(`Search (Client/Proposal/Mobile): ${searchText}`, 40, 105);
		doc.text(`Rows: ${rowsToExport.length}`, 40, 120);

		// columns = currently visible columns
		const cols: Array<{ key: ColKey; label: string }> = [
			{ key: 'date', label: 'Date' },
			{ key: 'lab', label: 'Lab' },
			{ key: 'tpa', label: 'TPA' },
			{ key: 'ins', label: 'Insurance' },
			{ key: 'status', label: 'Status' },
			{ key: 'client', label: 'Client' },
			{ key: 'proposal', label: 'Proposal' },
			{ key: 'mobile', label: 'Mobile' },
			{ key: 'visit', label: 'Visit' },
			{ key: 'location', label: 'Location' },
			{ key: 'gender', label: 'Gender' },
			{ key: 'age', label: 'Age' },
			{ key: 'serviceType', label: 'Service Type' },
			{ key: 'payment', label: 'Payment Status' },
			{ key: 'extra', label: 'Extra (Rs)' },
			{ key: 'paymentDate', label: 'Payment Date' },
			{ key: 'tests', label: 'Tests' },
		].filter(c => visibleCols[c.key]);

		const head = [cols.map(c => c.label)];

		const body = rowsToExport.map(a => {
			const lab = labs.find(l => l.id === a.labId);
			const vendor = (lab?.vendors?.find(v => v.id === a.vendorId)) || vendors.find(v => v.id === a.vendorId);
			const ins = insurers.find(i => i.id === a.insuranceCompanyId);

			const visitTypeLabel = a.visitType === 'CENTER' ? 'Center' : a.visitType === 'HOME' ? 'Home' : '';

			const cell = (k: ColKey) => {
				switch (k) {
					case 'date': return formatDateOnly(a.apptAt);
					case 'lab': return lab?.nickName ?? '';
					case 'tpa': return vendor?.tpaName ?? '';
					case 'ins': return ins?.nickName ?? '';
					case 'status': return a.status ?? '';
					case 'client': return a.clientName ?? '';
					case 'proposal': return a.clientRef ?? '';
					case 'mobile': return a.phone ?? '';
					case 'visit': return visitTypeLabel;
					case 'location': return a.location ?? '';
					case 'gender': return a.gender ?? '';
					case 'age': return a.age != null ? String(a.age) : '';
					case 'serviceType': return a.serviceType ?? '';
					case 'payment': return a.paymentStatus ?? '';
					case 'extra': return a.extraChargeRs != null ? String(a.extraChargeRs) : '';
					case 'paymentDate': return formatDateOnly(a.paymentDate);
					case 'tests': return a.testSummary ?? formatTestCodes(a);
					default: return '';
				}
			};

			return cols.map(c => cell(c.key));
		});

		// Footer only if Extra is visible
		const showExtraTotal = cols.some(c => c.key === 'extra');
		const extraSum = rowsToExport.reduce((sum, r) => sum + (Number(r.extraChargeRs) || 0), 0);

		autoTable(doc, {
			startY: 140,
			head,
			body,
			styles: { fontSize: 8, cellPadding: 4 },
			headStyles: { fontSize: 8 },
			theme: 'grid',
			didDrawPage: () => { },
		});

		if (showExtraTotal) {
			const endY = (doc as any).lastAutoTable?.finalY ?? 140;
			doc.setFontSize(10);
			doc.text(`Total Extra (Rs): ${extraSum}`, 40, endY + 18);
		}

		const fileName = `appointments_${new Date().toISOString().slice(0, 10)}.pdf`;
		doc.save(fileName);
	}

	async function onDelete() {
		if (!selectedRowId) return;
		setDelLoading(true); setDelErr(null);
		try {
			const res = await fetch(`/api/appointments/${selectedRowId}`, { method: 'DELETE' });
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error((data as any)?.error || 'Delete failed');
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

	async function handleSaveTests() {
		let apptId = selectedRowId || editingId;

		try {
			if (pendingCreate && !apptId) {
				const missing = validateRequiredFields();
				if (missing.length) {
					const ordered = [
						'Lab Name',
						'Client Name',
						'Client ID / Proposal No',
						'Gender',
						'Service Type',
						'Extra Charge (Rs)',
					];
					const display = ordered.filter(x => missing.includes(x));
					setReqList(display.length ? display : missing);
					setReqOpen(true);

					if (missing.includes('Extra Charge (Rs)')) setTimeout(() => extraRef.current?.focus(), 0);
					return;
				}

				const payload = {
					apptAt,
					labId,
					vendorId: vendorId || null,
					insuranceVendorId: vendorId || null,
					insuranceCompanyId: insuranceCompanyId || null,

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

				const createRes = await fetch('/api/appointments', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});
				const created = await createRes.json().catch(() => ({} as any));
				if (!createRes.ok || !created?.id) {
					setReqList([created?.error || 'Could not create appointment']);
					setReqOpen(true);
					return;
				}

				apptId = created.id;
				setSelectedRowId(apptId);
				setEditingId(apptId);
			}

			if (!apptId) {
				setReqList(['Please select an appointment row before saving tests.']);
				setReqOpen(true);
				return;
			}

			const testsPayload = { bloodTest, urineTest, ecg, tmt, applicationForm };

			const res = await fetch(`/api/appointments/${apptId}/tests`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(testsPayload),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error((data as any)?.error || 'Save tests failed');

			setTestsOpen(false);
			await load();

			if (pendingCreate) {
				setPendingCreate(false);
				setFormOk('Created!');
				resetForm();
			} else {
				setFormOk('Tests saved');
			}
		} catch (e: any) {
			setReqList([e?.message || 'Network error']);
			setReqOpen(true);
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

	const isOuter = (serviceType || '').trim().toLowerCase() === 'outer';
	const extraMissingForOuter = isOuter && (!extraChargeRs || Number(extraChargeRs) <= 0);

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
					<div className="grid grid-cols-1 md:grid-cols-[130px_90px_170px_180px_160px_120px_170px_auto] gap-3 px-4 py-2 items-end">
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
							<label className="block text-sm mb-1">
								Extra Charge (Rs) {isOuter ? <span className="text-red-600">*</span> : null}
							</label>
							<input
								ref={extraRef}
								type="number"
								min={0}
								className={[
									'w-full border rounded px-3 py-2',
									extraMissingForOuter ? 'border-red-500 focus:ring-red-200 focus:border-red-500' : '',
								].join(' ')}
								value={extraChargeRs}
								onChange={(e) => setExtraChargeRs(e.target.value)}
								placeholder={isOuter ? 'Required for Outer' : ''}
							/>
						</div>

						<div>
							<label className="block text-sm mb-1">Payment Date</label>
							<input type="date" className="w-full border rounded px-3 py-2" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
						</div>
					</div>

					<div className="px-3 pb-3 py-2">
						<div className="flex gap-2">
							<button className="rounded bg-brand text-white px-4 py-2">
								{editingId ? 'Update' : 'Create'}
							</button>
							<button type="button" className="rounded border px-4 py-2" onClick={resetForm}>Reset</button>
						</div>

						{!editingId && (
							<div className="mt-2 text-xs text-gray-500">
								Note: When you click <b>Create</b>, Test Details popup will open to avoid missing test info.
							</div>
						)}
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
									placeholder="Client, Proposal Id, Mobile…"
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

						{/* TPA filter */}
						<div>
							<label className="block text-xs text-gray-600 mb-1">TPA</label>
							<select
								className="border rounded px-3 py-2 min-w-[220px]"
								value={fTpaId}
								onChange={(e) => setFTpaId(e.target.value)}
							>
								<option value="">All TPA</option>
								{vendors.map(v => <option key={v.id} value={v.id}>{v.tpaName}</option>)}
							</select>
						</div>

						{/* Visit Type filter */}
						<div>
							<label className="block text-xs text-gray-600 mb-1">Visit Type</label>
							<select
								className="border rounded px-3 py-2 min-w-[160px]"
								value={fVisitType}
								onChange={(e) => setFVisitType(e.target.value)}
							>
								<option value="">All</option>
								{VISIT_TYPE_OPTS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
							</select>
						</div>

						{/* ✅ Service Type filter (replaces Location filter) */}
						<div>
							<label className="block text-xs text-gray-600 mb-1">Service Type</label>
							<select
								className="border rounded px-3 py-2 min-w-[160px]"
								value={fServiceType}
								onChange={(e) => setFServiceType(e.target.value)}
							>
								<option value="">All</option>
								{SERVICE_TYPE_OPTS.map(s => <option key={s} value={s}>{s}</option>)}
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
						<button
							type="button"
							className="inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
							onClick={() => exportFilteredToPdf(filtered)}
							title="Export filtered rows to PDF"
						>
							<FileDown className="h-4 w-4" />
							Export PDF
						</button>

						{selectedRowId && (
							<>
								<button
									type="button"
									className="inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
									onClick={() => window.open(`/appointments/receipt/${selectedRowId}`, '_blank', 'noopener')}
									title="Print / Save Receipt"
								>
									Print
								</button>

								<button
									type="button"
									className="inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm hover:bg-gray-50"
									onClick={() => { setPendingCreate(false); setTestsOpen(true); }}
									title="Add test details"
								>
									Tests
								</button>

								<button
									type="button"
									className="inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
									onClick={() => { setDelErr(null); setDelOpen(true); }}
									title="Delete (soft delete)"
								>
									<Trash2 className="h-4 w-4" />
									Delete
								</button>
							</>
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
									{visibleCols.tests && <SortTh k="tests" label="Test" />}
								</tr>
							</thead>

							<tbody>
								{loading ? (
									<tr>
										<td colSpan={Math.max(visibleColCount, 1)} className="px-3 py-4 text-center text-sm text-gray-500">
											Loading…
										</td>
									</tr>
								) : (
									(() => {
										if (filtered.length === 0) {
											return (
												<tr>
													<td colSpan={Math.max(visibleColCount, 1)} className="px-3 py-4 text-center text-sm text-gray-500">
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
													{visibleCols.tests && (
														<td className="px-3 py-2 text-sm whitespace-nowrap">
															{a.testSummary ?? formatTestCodes(a)}
														</td>
													)}
												</tr>
											);
										});
									})()
								)}
							</tbody>

							{/* ✅ Footer total only when Extra column is visible */}
							{visibleCols.extra && (
								<tfoot className="sticky bottom-0 bg-white">
									<tr className="border-t">
										<td
											colSpan={Math.max(visibleColCount - 1, 1)}
											className="px-3 py-2 text-sm font-semibold text-right bg-gray-50"
										>
											Total Extra (Rs)
										</td>
										<td className="px-3 py-2 text-sm font-semibold text-right bg-gray-50">
											{extraTotal}
										</td>
									</tr>
								</tfoot>
							)}
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

			{/* Tests modal (unchanged UI) */}
			{testsOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
					<div className="bg-white rounded-2xl shadow-xl w-full max-w-xl overflow-hidden">
						<div className="flex items-start justify-between p-4 border-b">
							<div>
								<h3 className="text-base font-semibold">Test Details</h3>
								<p className="text-xs text-gray-500 mt-0.5">
									Please confirm tests before saving the appointment.
								</p>
							</div>
							<button
								className="p-1 rounded hover:bg-gray-100"
								onClick={() => { setTestsOpen(false); setPendingCreate(false); }}
								title="Close"
							>
								<X className="h-5 w-5" />
							</button>
						</div>

						<div className="p-4 space-y-4 text-sm">
							<div className="rounded-xl border p-4">
								<div className="font-medium mb-2">Blood Test</div>
								<div className="flex flex-wrap gap-2">
									<Pill active={bloodTest === 'No'} onClick={() => setBloodTest('No')}>No</Pill>
									<Pill active={bloodTest === 'FB'} onClick={() => setBloodTest('FB')}>FB (Fasting)</Pill>
									<Pill active={bloodTest === 'B'} onClick={() => setBloodTest('B')}>B (Random)</Pill>
								</div>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<div className="rounded-xl border p-4">
									<div className="font-medium mb-2">Urine Test</div>
									<div className="flex gap-2">
										<Pill active={urineTest === 'No'} onClick={() => setUrineTest('No')}>No</Pill>
										<Pill active={urineTest === 'Yes'} onClick={() => setUrineTest('Yes')}>Yes</Pill>
									</div>
								</div>

								<div className="rounded-xl border p-4">
									<div className="font-medium mb-2">ECG</div>
									<div className="flex gap-2">
										<Pill active={ecg === 'No'} onClick={() => setEcg('No')}>No</Pill>
										<Pill active={ecg === 'Yes'} onClick={() => setEcg('Yes')}>Yes</Pill>
									</div>
								</div>

								<div className="rounded-xl border p-4">
									<div className="font-medium mb-2">TMT</div>
									<div className="flex gap-2">
										<Pill active={tmt === 'No'} onClick={() => setTmt('No')}>No</Pill>
										<Pill active={tmt === 'Yes'} onClick={() => setTmt('Yes')}>Yes</Pill>
									</div>
								</div>

								<div className="rounded-xl border p-4">
									<div className="font-medium mb-2">Application Form</div>
									<select
										className="w-full border rounded-lg px-3 py-2"
										value={applicationForm}
										onChange={(e) => setApplicationForm(e.target.value as 'MER' | 'FMR')}
									>
										<option value="MER">MER</option>
										<option value="FMR">FMR</option>
									</select>
								</div>
							</div>

							<div className="rounded-xl bg-gray-50 border px-4 py-3 text-xs text-gray-600">
								<b>Summary:</b> {[
									bloodTest !== 'No' ? bloodTest : null,
									urineTest === 'Yes' ? 'U' : null,
									ecg === 'Yes' ? 'ECG' : null,
									tmt === 'Yes' ? 'TMT' : null,
									applicationForm,
								].filter(Boolean).join(', ') || 'No tests selected'}
							</div>
						</div>

						<div className="p-4 border-t flex justify-end gap-2">
							<button
								type="button"
								className="rounded-lg border px-4 py-2 text-sm"
								onClick={() => { setTestsOpen(false); setPendingCreate(false); }}
							>
								Cancel
							</button>
							<button
								type="button"
								className="rounded-lg bg-brand text-white px-4 py-2 text-sm"
								onClick={handleSaveTests}
							>
								Save
							</button>
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
	if (!fDateFrom && !fDateTo) rangeLabel = 'All dates';
	else if (fDateFrom && fDateTo) rangeLabel = `${fDateFrom} → ${fDateTo}`;
	else if (fDateFrom) rangeLabel = `${fDateFrom} → …`;
	else rangeLabel = `… → ${fDateTo}`;

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
	visibleCols: Record<'date' | 'lab' | 'tpa' | 'ins' | 'client' | 'proposal' | 'mobile' | 'visit' | 'location' | 'status' | 'extra' | 'payment' | 'gender' | 'age' | 'serviceType' | 'paymentDate' | 'tests', boolean>;
	toggleCol: (k: any) => void;
}>) {
	const items: [keyof typeof visibleCols, string][] = [
		['date', 'Date'], ['lab', 'Lab'], ['tpa', 'TPA'], ['ins', 'Insurance'],
		['client', 'Client'], ['proposal', 'Proposal No'], ['status', 'Status'],
		['visit', 'Visit Type'], ['location', 'Location'],
		['gender', 'Gender'], ['age', 'Age'], ['mobile', 'Mobile'],
		['serviceType', 'Service Type'], ['payment', 'Payment Status'],
		['extra', 'Extra Rs'], ['paymentDate', 'Payment Date'],
		['tests', 'Test'],
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