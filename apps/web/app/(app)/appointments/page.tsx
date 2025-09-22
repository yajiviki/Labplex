'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronUp, Search } from 'lucide-react';

type VendorWithCompanies = {
	id: string;
	vendorId: string; // e.g. TPA01
	tpaName: string;
	companies: { id: string; name: string; code?: string | null }[];
};

type AppointmentRow = {
	id: string;
	source: 'TPA' | 'Doctor Ref' | 'Direct Visit' | string;
	proposalNo?: string | null;     // if source === 'TPA'
	patientId?: string | null;      // if source !== 'TPA' (e.g., OPxxxx)
	patientName: string;

	gender?: string | null;
	age?: number | null;
	address?: string | null;

	tpaName?: string | null;        // only for TPA (we will fill from dropdown)
	insuranceName?: string | null;  // only for TPA (we will fill from dropdown)

	doctorName?: string | null;     // only for non-TPA

	visitType: 'CENTER' | 'HOME' | string;
	status: 'BOOKED' | 'CHECKED IN' | 'SAMPLING' | 'PROCESSING' | 'REPORT READY' | 'CLOSED' | 'CANCELED' | string;

	mobile: string;
	apptAt: string;                 // ISO string
	testCode?: string | null;
	testDescription?: string | null;
	createdAt: string;              // ISO string
};

const STATUS_OPTIONS = [
	'BOOKED',
	'CHECKED IN',
	'SAMPLING',
	'PROCESSING',
	'REPORT READY',
	'CLOSED',
	'CANCELED',
];

const SOURCE_OPTIONS = ['TPA', 'Doctor Ref', 'Direct Visit'] as const;
const VISIT_TYPES = ['CENTER', 'HOME'] as const;

type SortKey = keyof Pick<
	AppointmentRow,
	'patientName' | 'mobile' | 'status' | 'visitType' | 'apptAt' | 'createdAt'
>;
type SortDir = 'asc' | 'desc';

export default function AppointmentPage() {
	const [rows, setRows] = useState<AppointmentRow[]>([]);
	const [loading, setLoading] = useState(false);

	// Vendors (TPA) with companies (insurance)
	const [vendors, setVendors] = useState<VendorWithCompanies[]>([]);

	// ---- Form state ----
	const [editingId, setEditingId] = useState<string | null>(null);
	const [source, setSource] = useState<AppointmentRow['source'] | ''>('');
	const [proposalNo, setProposalNo] = useState('');
	const [patientId, setPatientId] = useState('');
	const [patientName, setPatientName] = useState('');

	const [gender, setGender] = useState('');
	const [age, setAge] = useState('');
	const [address, setAddress] = useState('');

	// Dropdown selections (IDs) + derived names for payload
	const [vendorId, setVendorId] = useState('');                 // selected TPA id
	const [insuranceCompanyId, setInsuranceCompanyId] = useState(''); // selected insurance id

	const [doctorName, setDoctorName] = useState('');

	const [visitType, setVisitType] = useState<AppointmentRow['visitType'] | ''>('');
	const [status, setStatus] = useState<AppointmentRow['status']>('BOOKED');

	const [mobile, setMobile] = useState('');
	const [apptAt, setApptAt] = useState('');
	const [testCode, setTestCode] = useState('');
	const [testDescription, setTestDescription] = useState('');

	// messages
	const [formErr, setFormErr] = useState<string | null>(null);
	const [formOk, setFormOk] = useState<string | null>(null);

	// table filters/search/sort
	const [statusFilter, setStatusFilter] = useState('');
	const [q, setQ] = useState('');
	const [sortKey, setSortKey] = useState<SortKey>('createdAt');
	const [sortDir, setSortDir] = useState<SortDir>('desc');

	async function load() {
		setLoading(true);
		try {
			const [ra, rv] = await Promise.all([
				fetch('/api/appointments', { cache: 'no-store' }),
				fetch('/api/vendors?include=companies', { cache: 'no-store' }),
			]);
			const da = await ra.json().catch(() => []);
			const dv = await rv.json().catch(() => []);
			setRows(Array.isArray(da) ? da : []);
			setVendors(Array.isArray(dv) ? dv : []);
		} catch {
			setRows([]);
			setVendors([]);
		} finally {
			setLoading(false);
		}
	}
	useEffect(() => { load(); }, []);

	function resetForm() {
		setEditingId(null);
		setSource('');
		setProposalNo('');
		setPatientId('');
		setPatientName('');

		setGender('');
		setAge('');
		setAddress('');

		setVendorId('');
		setInsuranceCompanyId('');
		setDoctorName('');

		setVisitType('');
		setStatus('BOOKED');

		setMobile('');
		setApptAt('');
		setTestCode('');
		setTestDescription('');

		setFormErr(null);
		setFormOk(null);
	}

	// insurance options filtered by chosen vendor
	const insuranceOptions = useMemo(() => {
		const v = vendors.find(v => v.id === vendorId);
		return v?.companies || [];
	}, [vendorId, vendors]);

	// when vendor changes, clear insurance
	useEffect(() => { setInsuranceCompanyId(''); }, [vendorId]);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setFormErr(null);
		setFormOk(null);

		// Basic required fields
		const phoneDigits = mobile.replace(/\D+/g, '');
		if (!source || !patientName.trim() || !phoneDigits || !apptAt || !visitType) {
			return setFormErr('Please fill mandatory fields: Source, Patient Name, Mobile, Appointment DateTime, Visit Type.');
		}
		if (phoneDigits.length < 10 || phoneDigits.length > 15) {
			return setFormErr('Please enter a valid Mobile number (10–15 digits).');
		}

		// Conditional requirements
		if (source === 'TPA') {
			if (!proposalNo.trim()) return setFormErr('Proposal No is required for TPA source.');
			if (!vendorId) return setFormErr('Please choose a TPA.');
			if (!insuranceCompanyId) return setFormErr('Please choose an Insurance Company.');
		} else {
			if (!patientId.trim()) return setFormErr('Patient ID is required for Doctor Ref / Direct Visit.');
		}

		// derive tpaName / insuranceName strings from selected ids (for payload)
		const selectedVendor = vendors.find(v => v.id === vendorId) || null;
		const selectedCompany = insuranceOptions.find(c => c.id === insuranceCompanyId) || null;

		const payload = {
			source,
			proposalNo: source === 'TPA' ? proposalNo.trim() : null,
			patientId: source === 'TPA' ? null : patientId.trim(),
			patientName: patientName.trim(),

			gender: gender || null,
			age: age ? parseInt(age, 10) : null,
			address: address || null,

			// We keep saving names as you requested; if you want IDs too, I can extend the API/models
			tpaName: source === 'TPA' ? (selectedVendor?.tpaName || null) : null,
			insuranceName: source === 'TPA' ? (selectedCompany?.name || null) : null,

			doctorName: source !== 'TPA' ? (doctorName || null) : null,

			visitType,
			status,
			mobile: phoneDigits,
			apptAt: new Date(apptAt).toISOString(),
			testCode: testCode || null,
			testDescription: testDescription || null,
		};

		const res = await fetch(editingId ? `/api/appointments/${editingId}` : '/api/appointments', {
			method: editingId ? 'PUT' : 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) return setFormErr(data?.error || 'Save failed');

		setFormOk(editingId ? 'Updated!' : 'Created!');
		await load();
		if (!editingId) resetForm();
	}

	// When starting edit, try to map existing tpaName/insuranceName to current dropdown options
	function startEdit(a: AppointmentRow) {
		setEditingId(a.id);
		setSource(a.source || '');
		setProposalNo(a.proposalNo || '');
		setPatientId(a.patientId || '');
		setPatientName(a.patientName || '');

		setGender(a.gender || '');
		setAge(a.age != null ? String(a.age) : '');
		setAddress(a.address || '');

		// Map by names if possible
		if (a.source === 'TPA') {
			// find vendor by tpaName (strict match); if none, clear
			const v = vendors.find(v => v.tpaName === (a.tpaName || ''));
			setVendorId(v?.id || '');
			// insurance will be set after vendorId effect runs; try to pre-pick by name
			const companies = (v?.companies || []);
			const c = companies.find(c => c.name === (a.insuranceName || ''));
			// If vendor isn't ready yet (vendors may still be loading), we’ll do a second pass below in useEffect.
			setInsuranceCompanyId(c?.id || '');
		} else {
			setVendorId('');
			setInsuranceCompanyId('');
		}

		setDoctorName(a.doctorName || '');

		setVisitType((a.visitType as any) || '');
		setStatus((a.status as any) || 'BOOKED');

		setMobile(a.mobile || '');
		setApptAt(a.apptAt ? a.apptAt.slice(0, 16) : '');
		setTestCode(a.testCode || '');
		setTestDescription(a.testDescription || '');

		setFormErr(null);
		setFormOk(null);
	}

	// If vendors arrive after an edit starts, try again to map by names
	useEffect(() => {
		if (!editingId) return;
		// find the appointment row currently being edited
		const a = rows.find(r => r.id === editingId);
		if (!a || a.source !== 'TPA') return;

		if (!vendorId && a.tpaName) {
			const v = vendors.find(v => v.tpaName === a.tpaName);
			if (v?.id) setVendorId(v.id);
		}
		if (vendorId && !insuranceCompanyId && a.insuranceName) {
			const v = vendors.find(v => v.id === vendorId);
			const c = v?.companies.find(c => c.name === a.insuranceName);
			if (c?.id) setInsuranceCompanyId(c.id);
		}
	}, [vendors, rows, editingId, vendorId, insuranceCompanyId]);

	function sortBy(key: SortKey) {
		if (key === sortKey) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
		else { setSortKey(key); setSortDir('asc'); }
	}

	const filtered = useMemo(() => {
		let base = [...rows];

		if (statusFilter) base = base.filter(r => r.status === statusFilter);

		const term = q.trim().toLowerCase();
		if (term) {
			base = base.filter(r =>
				[
					r.patientName, r.mobile, r.proposalNo, r.patientId, r.doctorName,
					r.tpaName, r.insuranceName, r.testCode, r.testDescription, r.address, r.source, r.visitType
				]
					.filter(Boolean)
					.some(v => String(v).toLowerCase().includes(term))
			);
		}

		return base.sort((a, b) => {
			const va = (a[sortKey] ?? '') as any;
			const vb = (b[sortKey] ?? '') as any;
			if (va === vb) return 0;
			if (sortDir === 'asc') return va > vb ? 1 : -1;
			return va < vb ? 1 : -1;
		});
	}, [rows, statusFilter, q, sortKey, sortDir]);

	const Col = ({ k, label }: { k: SortKey; label: string }) => {
		const active = sortKey === k;
		return (
			<th
				onClick={() => sortBy(k)}
				className="px-3 py-2 text-left text-sm font-semibold text-gray-700 cursor-pointer"
			>
				<div className="inline-flex items-center gap-1">
					<span>{label}</span>
					{active ? (sortDir === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : null}
				</div>
			</th>
		);
	};

	return (
		<div className="space-y-4">
			{/* Title Bar */}
			<div className="rounded-xl border bg-white px-5 py-4 shadow-sm flex items-center gap-3">
				<div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand-600">
					<CalendarDays className="h-5 w-5" />
				</div>
				<h1 className="text-2xl font-bold tracking-tight">Appointment Management</h1>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
				{/* FORM */}
				<form onSubmit={onSubmit} className="lg:col-span-5 rounded-xl border bg-white p-4 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-3">
					<h2 className="md:col-span-2 font-semibold">{editingId ? 'Update Appointment' : 'Add Appointment'}</h2>
					{formErr && <div className="md:col-span-2 text-sm text-red-600">{formErr}</div>}
					{formOk && <div className="md:col-span-2 text-sm text-green-600">{formOk}</div>}

					{/* Source & Conditional IDs */}
					<div>
						<label className="block text-sm mb-1">Source *</label>
						<select value={source} onChange={(e) => setSource(e.target.value as any)} className="w-full border rounded px-3 py-2">
							<option value="">Select…</option>
							{SOURCE_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
						</select>
					</div>

					{source === 'TPA' ? (
						<div>
							<label className="block text-sm mb-1">Proposal No *</label>
							<input value={proposalNo} onChange={(e) => setProposalNo(e.target.value)} className="w-full border rounded px-3 py-2" />
						</div>
					) : source ? (
						<div>
							<label className="block text-sm mb-1">Patient ID *</label>
							<input value={patientId} onChange={(e) => setPatientId(e.target.value)} className="w-full border rounded px-3 py-2" />
						</div>
					) : <div />}

					{/* Patient Name & Mobile */}
					<div>
						<label className="block text-sm mb-1">Patient Name *</label>
						<input value={patientName} onChange={(e) => setPatientName(e.target.value)} className="w-full border rounded px-3 py-2" />
					</div>
					<div>
						<label className="block text-sm mb-1">Mobile *</label>
						<input value={mobile} onChange={(e) => setMobile(e.target.value)} className="w-full border rounded px-3 py-2" />
					</div>

					{/* Gender & Age */}
					<div>
						<label className="block text-sm mb-1">Gender</label>
						<select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full border rounded px-3 py-2">
							<option value="">Select…</option>
							<option>Male</option>
							<option>Female</option>
							<option>Other</option>
						</select>
					</div>
					<div>
						<label className="block text-sm mb-1">Age</label>
						<input type="number" value={age} onChange={(e) => setAge(e.target.value)} className="w-full border rounded px-3 py-2" />
					</div>

					{/* Address (full width) */}
					<div className="md:col-span-2">
						<label className="block text-sm mb-1">Address</label>
						<input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full border rounded px-3 py-2" />
					</div>

					{/* TPA dropdowns */}
					{source === 'TPA' && (
						<>
							<div>
								<label className="block text-sm mb-1">TPA *</label>
								<select
									value={vendorId}
									onChange={(e) => setVendorId(e.target.value)}
									className="w-full border rounded px-3 py-2"
								>
									<option value="">Select TPA</option>
									{vendors.map(v => (
										<option key={v.id} value={v.id}>
											{v.vendorId} — {v.tpaName}
										</option>
									))}
								</select>
							</div>
							<div>
								<label className="block text-sm mb-1">Insurance *</label>
								<select
									value={insuranceCompanyId}
									onChange={(e) => setInsuranceCompanyId(e.target.value)}
									className="w-full border rounded px-3 py-2"
									disabled={!vendorId}
								>
									<option value="">{vendorId ? 'Select Insurance' : 'Choose TPA first'}</option>
									{insuranceOptions.map(c => (
										<option key={c.id} value={c.id}>{c.name}</option>
									))}
								</select>
							</div>
						</>
					)}

					{/* Doctor Name for non-TPA */}
					{source && source !== 'TPA' && (
						<div className="md:col-span-2">
							<label className="block text-sm mb-1">Doctor Name</label>
							<input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} className="w-full border rounded px-3 py-2" />
						</div>
					)}

					{/* Visit Type & Status */}
					<div>
						<label className="block text-sm mb-1">Visit Type *</label>
						<select value={visitType} onChange={(e) => setVisitType(e.target.value as any)} className="w-full border rounded px-3 py-2">
							<option value="">Select…</option>
							{VISIT_TYPES.map(v => <option key={v} value={v}>{v === 'CENTER' ? 'Center Visit' : 'Home Visit'}</option>)}
						</select>
					</div>
					<div>
						<label className="block text-sm mb-1">Status *</label>
						<select value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-full border rounded px-3 py-2">
							{STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
						</select>
					</div>

					{/* Appt datetime */}
					<div>
						<label className="block text-sm mb-1">Appointment DateTime *</label>
						<input type="datetime-local" value={apptAt} onChange={(e) => setApptAt(e.target.value)} className="w-full border rounded px-3 py-2" />
					</div>

					{/* Test fields */}
					<div>
						<label className="block text-sm mb-1">Test Code</label>
						<input value={testCode} onChange={(e) => setTestCode(e.target.value)} className="w-full border rounded px-3 py-2" />
					</div>
					<div className="md:col-span-2">
						<label className="block text-sm mb-1">Tests Description</label>
						<input value={testDescription} onChange={(e) => setTestDescription(e.target.value)} className="w-full border rounded px-3 py-2" />
					</div>

					<div className="md:col-span-2 flex gap-2 mt-2">
						<button className="rounded bg-brand text-white px-4 py-2">{editingId ? 'Update' : 'Create'}</button>
						<button type="button" onClick={resetForm} className="rounded border px-4 py-2">Reset</button>
					</div>
				</form>

				{/* TABLE */}
				<div className="lg:col-span-7 rounded-xl border bg-white p-4 shadow-sm">
					<div className="flex items-center justify-between mb-3">
						<h2 className="text-base font-semibold">Appointment Information</h2>
						<div className="flex items-center gap-2">
							<select
								value={statusFilter}
								onChange={(e) => setStatusFilter(e.target.value)}
								className="border rounded px-2 py-1 text-sm"
							>
								<option value="">All Status</option>
								{STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
							</select>
							<div className="relative">
								<Search className="h-4 w-4 absolute left-2 top-2.5 text-gray-400" />
								<input
									placeholder="Search…"
									className="pl-8 pr-3 py-2 border rounded w-64"
									value={q}
									onChange={(e) => setQ(e.target.value)}
								/>
							</div>
						</div>
					</div>

					<div className="overflow-x-auto">
						<table className="min-w-full border rounded">
							<thead className="bg-gray-50">
								<tr>
									<Col k="patientName" label="Patient" />
									<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">Source</th>
									<th className="px-3 py-2 text-left text-sm font-semibold text-gray-700">ID</th>
									<Col k="mobile" label="Mobile" />
									<Col k="visitType" label="Visit Type" />
									<Col k="status" label="Status" />
									<Col k="apptAt" label="Appointment" />
									<Col k="createdAt" label="Created" />
								</tr>
							</thead>
							<tbody>
								{loading ? (
									<tr><td colSpan={8} className="px-3 py-4 text-center text-sm text-gray-500">Loading…</td></tr>
								) : filtered.length === 0 ? (
									<tr><td colSpan={8} className="px-3 py-4 text-center text-sm text-gray-500">No appointments</td></tr>
								) : (
									filtered.map((a) => (
										<tr key={a.id} className="border-t hover:bg-gray-50">
											<td className="px-3 py-2 text-sm">
												<button onClick={() => startEdit(a)} className="underline">{a.patientName}</button>
											</td>
											<td className="px-3 py-2 text-sm">{a.source}</td>
											<td className="px-3 py-2 text-sm">{a.source === 'TPA' ? (a.proposalNo || '') : (a.patientId || '')}</td>
											<td className="px-3 py-2 text-sm">{a.mobile}</td>
											<td className="px-3 py-2 text-sm">{a.visitType === 'CENTER' ? 'Center Visit' : 'Home Visit'}</td>
											<td className="px-3 py-2 text-sm">{a.status}</td>
											<td className="px-3 py-2 text-sm">{new Date(a.apptAt).toLocaleString()}</td>
											<td className="px-3 py-2 text-sm">{new Date(a.createdAt).toLocaleDateString()}</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</div>
	);
}
