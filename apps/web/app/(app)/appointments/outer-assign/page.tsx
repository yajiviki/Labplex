'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { toPng } from 'html-to-image';
import {
	CalendarDays,
	Download,
	RefreshCcw,
	Save,
	AlertTriangle,
	Users,
	ChevronDown,
	ChevronUp,
	FileSpreadsheet,
	Columns3,
	X,
} from 'lucide-react';

type Lab = {
	id: string;
	name: string;
	nickName?: string | null;
	labCode?: string | null;
};

type Vendor = {
	id: string;
	vendorId?: string | null;
	tpaName?: string | null;
	nickName?: string | null;
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

	clientName: string;
	clientRef?: string | null;

	mobileNo: string;
	insuranceName: string;
	testSummary: string;
	location: string;
	status: string;

	visitType?: string | null;
	serviceType?: string | null;

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

type SortKey =
	| 'apptAt'
	| 'clientName'
	| 'mobileNo'
	| 'insuranceName'
	| 'testSummary'
	| 'visitType'
	| 'serviceType'
	| 'location'
	| 'staff'
	| 'remark'
	| 'status';

type ColumnKey =
	| 'appointment'
	| 'clientName'
	| 'mobileNo'
	| 'insuranceName'
	| 'testSummary'
	| 'visitType'
	| 'serviceType'
	| 'location'
	| 'staff'
	| 'remark'
	| 'status';

type ColumnDef = {
	key: ColumnKey;
	label: string;
	sortKey?: SortKey;
	minWidth?: string;
};

const ALL_COLUMNS: ColumnDef[] = [
	{ key: 'appointment', label: 'Appointment', sortKey: 'apptAt', minWidth: '180px' },
	{ key: 'clientName', label: 'Client Name', sortKey: 'clientName', minWidth: '170px' },
	{ key: 'mobileNo', label: 'Mobile No', sortKey: 'mobileNo', minWidth: '130px' },
	{ key: 'insuranceName', label: 'Insurance', sortKey: 'insuranceName', minWidth: '180px' },
	{ key: 'testSummary', label: 'Test', sortKey: 'testSummary', minWidth: '170px' },
	{ key: 'visitType', label: 'Visit Type', sortKey: 'visitType', minWidth: '110px' },
	{ key: 'serviceType', label: 'Service Type', sortKey: 'serviceType', minWidth: '120px' },
	{ key: 'location', label: 'Location', sortKey: 'location', minWidth: '220px' },
	{ key: 'staff', label: 'Staff', sortKey: 'staff', minWidth: '180px' },
	{ key: 'remark', label: 'Address Remark', sortKey: 'remark', minWidth: '220px' },
	{ key: 'status', label: 'Status', sortKey: 'status', minWidth: '150px' },
];

const DEFAULT_VISIBLE_COLUMNS: ColumnKey[] = [
	'appointment',
	'clientName',
	'mobileNo',
	'insuranceName',
	'testSummary',
	'visitType',
	'serviceType',
	'location',
	'staff',
	'remark',
	'status',
];

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

function ymdToday() {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function normalizeVisitType(v?: string | null) {
	const s = (v || '').toUpperCase().trim();
	if (s === 'CENTER') return 'CENTER';
	if (s === 'HOME') return 'HOME';
	return '';
}

function normalizeServiceType(v?: string | null) {
	const s = (v || '').toUpperCase().trim();
	if (s === 'OUTER') return 'OUTER';
	if (s === 'LOCAL') return 'LOCAL';
	return '';
}

function vendorLabel(v: Vendor) {
	const name = v.nickName || v.tpaName || 'TPA';
	const code = v.vendorId ? ` (${v.vendorId})` : '';
	return `${name}${code}`;
}

function normalizeStatus(v?: string | null) {
	return (v || '').trim().toUpperCase();
}

function isReportCompletedStatus(v?: string | null) {
	return normalizeStatus(v) === 'REPORT COMPLETED';
}

function escapeHtml(value: string) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

export default function OuterAssignmentsPage() {
	const exportRef = useRef<HTMLDivElement | null>(null);
	const columnMenuRef = useRef<HTMLDivElement | null>(null);
	const columnButtonRef = useRef<HTMLButtonElement | null>(null);

	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [exporting, setExporting] = useState(false);
	const [excelExporting, setExcelExporting] = useState(false);

	const [labs, setLabs] = useState<Lab[]>([]);
	const [vendors, setVendors] = useState<Vendor[]>([]);

	const [labId, setLabId] = useState<string>('');
	const [vendorId, setVendorId] = useState<string>('');
	const [staffFilter, setStaffFilter] = useState<string>('');

	const [rows, setRows] = useState<AssignmentRow[]>([]);
	const [allUsers, setAllUsers] = useState<UserRow[]>([]);
	const [users, setUsers] = useState<UserRow[]>([]);

	const [err, setErr] = useState<string | null>(null);
	const [ok, setOk] = useState<string | null>(null);

	const [dateFrom, setDateFrom] = useState<string>(() => ymdToday());
	const [dateTo, setDateTo] = useState<string>(() => ymdToday());

	const [visitType, setVisitType] = useState<string>('');
	const [serviceType, setServiceType] = useState<string>('');

	const [draftAssignedTo, setDraftAssignedTo] = useState<Record<string, string>>({});
	const [draftRemark, setDraftRemark] = useState<Record<string, string>>({});

	const [sortKey, setSortKey] = useState<SortKey>('apptAt');
	const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

	const [visibleColumns, setVisibleColumns] = useState<ColumnKey[]>(DEFAULT_VISIBLE_COLUMNS);
	const [showColumnMenu, setShowColumnMenu] = useState(false);
	const [mounted, setMounted] = useState(false);
	const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number }>({
		top: 0,
		left: 0,
		width: 260,
	});

	function sortBy(k: SortKey) {
		if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
		else {
			setSortKey(k);
			setSortDir('asc');
		}
	}

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

	async function loadVendors() {
		try {
			const res = await fetch('/api/vendors', { cache: 'no-store' });
			const data = await res.json().catch(() => []);
			if (!res.ok) return;
			const list = Array.isArray(data) ? data : [];
			list.sort((a: Vendor, b: Vendor) => vendorLabel(a).localeCompare(vendorLabel(b)));
			setVendors(list);
		} catch {
			// ignore
		}
	}

	function buildQuery(targetLabId?: string) {
		const sp = new URLSearchParams();

		if (targetLabId) sp.set('labId', targetLabId);
		if (dateFrom) sp.set('dateFrom', dateFrom);
		if (dateTo) sp.set('dateTo', dateTo);
		if (visitType) sp.set('visitType', visitType);
		if (serviceType) sp.set('serviceType', serviceType);
		if (vendorId) sp.set('vendorId', vendorId);

		const qs = sp.toString();
		return qs ? `?${qs}` : '';
	}

	async function loadAssignments(targetLabId?: string) {
		setLoading(true);
		setErr(null);
		setOk(null);

		try {
			const q = buildQuery(targetLabId);
			const res = await fetch(`/api/appointments/outer-assignments${q}`, { cache: 'no-store' });
			const data = (await res.json().catch(() => null)) as ApiResp | null;

			if (!res.ok) {
				setErr((data as any)?.error || 'Load failed');
				setRows([]);
				setUsers([]);
				setAllUsers([]);
				return;
			}

			if (!data) {
				setErr('Load failed');
				setRows([]);
				setUsers([]);
				setAllUsers([]);
				return;
			}

			setRows(Array.isArray(data.rows) ? data.rows : []);

			const all = Array.isArray(data.users) ? data.users : [];
			setAllUsers(all);

			const onlyUser = all.filter((u) => (u.role || '').toUpperCase() === 'USER');
			setUsers(onlyUser);

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
			setAllUsers([]);
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		setMounted(true);
		loadLabs();
		loadVendors();
		loadAssignments('');
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		loadAssignments(labId);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [labId, dateFrom, dateTo, visitType, serviceType, vendorId]);

	function updateColumnMenuPosition() {
		if (!columnButtonRef.current) return;
		const rect = columnButtonRef.current.getBoundingClientRect();
		const width = 260;
		const viewportPadding = 12;
		const desiredLeft = rect.right - width;
		const maxLeft = window.innerWidth - width - viewportPadding;
		const left = Math.max(viewportPadding, Math.min(desiredLeft, maxLeft));
		const top = rect.bottom + window.scrollY + 8;
		setMenuPos({ top, left, width });
	}

	useEffect(() => {
		if (!showColumnMenu) return;
		updateColumnMenuPosition();

		function onScrollOrResize() {
			updateColumnMenuPosition();
		}

		window.addEventListener('resize', onScrollOrResize);
		window.addEventListener('scroll', onScrollOrResize, true);

		return () => {
			window.removeEventListener('resize', onScrollOrResize);
			window.removeEventListener('scroll', onScrollOrResize, true);
		};
	}, [showColumnMenu]);

	useEffect(() => {
		function onClickOutside(e: MouseEvent) {
			const target = e.target as Node;
			const clickedInsideMenu = columnMenuRef.current?.contains(target);
			const clickedButton = columnButtonRef.current?.contains(target);
			if (!clickedInsideMenu && !clickedButton) {
				setShowColumnMenu(false);
			}
		}

		if (showColumnMenu) {
			document.addEventListener('mousedown', onClickOutside);
		}

		return () => {
			document.removeEventListener('mousedown', onClickOutside);
		};
	}, [showColumnMenu]);

	const userMap = useMemo(() => {
		const m = new Map<string, UserRow>();
		for (const u of allUsers) m.set(u.id, u);
		return m;
	}, [allUsers]);

	function inRange(iso: string | null, from: string, to: string) {
		if (!iso) return false;
		const ymd = formatDateOnly(iso);
		if (!ymd) return false;

		let f = from || '';
		let t = to || '';

		if (f && t && f > t) [f, t] = [t, f];

		if (f && ymd < f) return false;
		if (t && ymd > t) return false;

		return true;
	}

	function getCurrentAssignedToId(r: AssignmentRow) {
		return (draftAssignedTo[r.id] ?? r.assignedToId ?? '').trim();
	}

	function getCurrentRemark(r: AssignmentRow) {
		return (draftRemark[r.id] ?? r.addressRemark ?? '').trim();
	}

	function getAssignedUserName(r: AssignmentRow) {
		const staffId = getCurrentAssignedToId(r);
		if (!staffId) return '';
		const u = userMap.get(staffId);
		if (u) return userLabel(u);
		return staffId;
	}

	function isRowChanged(r: AssignmentRow) {
		const rowIsReportCompleted = isReportCompletedStatus(r.status);
		if (rowIsReportCompleted) return false;

		const originalAssignedToId = (r.assignedToId || '').trim();
		const originalRemark = (r.addressRemark || '').trim();
		const currentAssignedToId = getCurrentAssignedToId(r);
		const currentRemark = getCurrentRemark(r);

		return originalAssignedToId !== currentAssignedToId || originalRemark !== currentRemark;
	}

	const filteredSortedRows = useMemo(() => {
		const vt = normalizeVisitType(visitType);
		const st = normalizeServiceType(serviceType);

		const base = rows.filter((r) => {
			if (dateFrom || dateTo) {
				if (!inRange(r.apptAt, dateFrom, dateTo)) return false;
			}

			if (vt) {
				const rowVT = normalizeVisitType(r.visitType || '');
				if (rowVT !== vt) return false;
			}

			if (st) {
				const rowST = normalizeServiceType(r.serviceType || '');
				if (rowST !== st) return false;
			}

			if (staffFilter) {
				const rowStaffId = getCurrentAssignedToId(r);
				if (rowStaffId !== staffFilter) return false;
			}

			return true;
		});

		function val(r: AssignmentRow, k: SortKey) {
			switch (k) {
				case 'apptAt':
					return r.apptAt ? new Date(r.apptAt).getTime() : 0;
				case 'clientName':
					return (r.clientName || '').toLowerCase();
				case 'mobileNo':
					return (r.mobileNo || '').toLowerCase();
				case 'insuranceName':
					return (r.insuranceName || '').toLowerCase();
				case 'testSummary':
					return (r.testSummary || '').toLowerCase();
				case 'visitType':
					return normalizeVisitType(r.visitType || '');
				case 'serviceType':
					return normalizeServiceType(r.serviceType || '');
				case 'location':
					return (r.location || '').toLowerCase();
				case 'status':
					return (r.status || '').toLowerCase();
				case 'staff':
					return getAssignedUserName(r).toLowerCase();
				case 'remark':
					return getCurrentRemark(r).toLowerCase();
				default:
					return '';
			}
		}

		return [...base].sort((a, b) => {
			const va = val(a, sortKey);
			const vb = val(b, sortKey);

			if (va === vb) return 0;

			const cmp = va > vb ? 1 : -1;
			return sortDir === 'asc' ? cmp : -cmp;
		});
	}, [rows, dateFrom, dateTo, visitType, serviceType, staffFilter, sortKey, sortDir, draftAssignedTo, draftRemark, userMap]);

	const changedFilteredRows = useMemo(() => {
		return filteredSortedRows.filter((r) => isRowChanged(r));
	}, [filteredSortedRows]);

	const stats = useMemo(() => {
		const total = filteredSortedRows.length;
		const assigned = filteredSortedRows.filter((r) => getCurrentAssignedToId(r)).length;
		const missingRemark = filteredSortedRows.filter((r) => !getCurrentRemark(r)).length;
		const changed = changedFilteredRows.length;
		return { total, assigned, missingRemark, changed };
	}, [filteredSortedRows, changedFilteredRows]);

	const groupedForExport = useMemo(() => {
		const groups = new Map<string, AssignmentRow[]>();

		for (const r of filteredSortedRows) {
			const staffId = getCurrentAssignedToId(r);
			const key = staffId || '__UNASSIGNED__';
			const arr = groups.get(key) ?? [];
			arr.push(r);
			groups.set(key, arr);
		}

		const entries = Array.from(groups.entries()).map(([staffId, list]) => {
			const staffName =
				staffId === '__UNASSIGNED__'
					? 'Unassigned'
					: userMap.get(staffId)
						? userLabel(userMap.get(staffId) as UserRow)
						: staffId || 'Unknown User';
			return { staffId, staffName, list };
		});

		entries.sort((a, b) => {
			if (a.staffId === '__UNASSIGNED__') return 1;
			if (b.staffId === '__UNASSIGNED__') return -1;
			return a.staffName.localeCompare(b.staffName);
		});

		return entries;
	}, [filteredSortedRows, draftAssignedTo, userMap]);

	const visibleColumnDefs = useMemo(() => {
		return ALL_COLUMNS.filter((col) => visibleColumns.includes(col.key));
	}, [visibleColumns]);

	function toggleColumn(key: ColumnKey) {
		setVisibleColumns((prev) => {
			if (prev.includes(key)) {
				if (prev.length === 1) return prev;
				return prev.filter((k) => k !== key);
			}
			const ordered = ALL_COLUMNS.map((c) => c.key).filter((k) => prev.includes(k) || k === key);
			return ordered;
		});
	}

	function resetColumns() {
		setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
	}

	function getCellValue(r: AssignmentRow, key: ColumnKey) {
		const vt = normalizeVisitType(r.visitType || '') || '-';
		const st = normalizeServiceType(r.serviceType || '') || '-';

		switch (key) {
			case 'appointment':
				return `${formatDateOnly(r.apptAt)} ${formatTime(r.apptAt)}`.trim();
			case 'clientName':
				return r.clientName || '';
			case 'mobileNo':
				return r.mobileNo || '';
			case 'insuranceName':
				return r.insuranceName || '';
			case 'testSummary':
				return r.testSummary || '';
			case 'visitType':
				return vt;
			case 'serviceType':
				return st;
			case 'location':
				return r.location || '';
			case 'staff':
				return getAssignedUserName(r) || 'Unassigned';
			case 'remark':
				return getCurrentRemark(r) || '';
			case 'status':
				return r.status || '';
			default:
				return '';
		}
	}

	async function saveAll() {
		setErr(null);
		setOk(null);

		if (!filteredSortedRows.length) {
			setErr('No rows in the current filter to save.');
			return;
		}

		const itemsToSave = changedFilteredRows.map((r) => ({
			id: r.id,
			assignedToId: getCurrentAssignedToId(r),
			addressRemark: getCurrentRemark(r),
		}));

		if (!itemsToSave.length) {
			setErr('No modified rows found in the current filter.');
			return;
		}

		for (const item of itemsToSave) {
			if (!item.assignedToId) {
				setErr('Please select Staff for all modified rows.');
				return;
			}
			if (!item.addressRemark) {
				setErr('Please enter Address Remark for all modified rows.');
				return;
			}
		}

		setSaving(true);
		try {
			const payload: any = { items: itemsToSave };
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

			setOk(`Assignments saved (${itemsToSave.length})`);
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

	function exportExcel() {
		try {
			setErr(null);
			setOk(null);
			setExcelExporting(true);

			const columns = visibleColumnDefs;

			const headerHtml = columns
				.map((col) => `<th style="background:#f3f4f6;font-weight:700;border:1px solid #d1d5db;padding:8px;text-align:left;">${escapeHtml(col.label)}</th>`)
				.join('');

			const rowsHtml = filteredSortedRows
				.map((r) => {
					const cells = columns
						.map((col) => {
							const value = getCellValue(r, col.key);
							return `<td style="border:1px solid #d1d5db;padding:8px;vertical-align:top;">${escapeHtml(value)}</td>`;
						})
						.join('');

					return `<tr>${cells}</tr>`;
				})
				.join('');

			const title = 'Outer Appointment Assignment';
			const meta = [
				`Date Range: ${dateFrom || 'All'} to ${dateTo || 'All'}`,
				`Lab: ${labId ? labs.find((l) => l.id === labId)?.nickName || labs.find((l) => l.id === labId)?.name || labId : 'All Labs'}`,
				`TPA: ${vendorId ? selectedVendorLabel : 'All TPA'}`,
				`Staff: ${staffFilter ? selectedStaffLabel : 'All Staff'}`,
				`Visit Type: ${visitType || 'All'}`,
				`Service Type: ${serviceType || 'All'}`,
				`Filtered Rows: ${filteredSortedRows.length}`,
			];

			const html = `
				<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
					<head>
						<meta charset="utf-8" />
						<!--[if gte mso 9]>
						<xml>
							<x:ExcelWorkbook>
								<x:ExcelWorksheets>
									<x:ExcelWorksheet>
										<x:Name>Outer Assignments</x:Name>
										<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
									</x:ExcelWorksheet>
								</x:ExcelWorksheets>
							</x:ExcelWorkbook>
						</xml>
						<![endif]-->
					</head>
					<body>
						<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111827;">
							<div style="font-size:18px;font-weight:700;margin-bottom:10px;">${escapeHtml(title)}</div>
							${meta.map((m) => `<div style="margin-bottom:4px;">${escapeHtml(m)}</div>`).join('')}
							<table style="border-collapse:collapse;margin-top:14px;min-width:1200px;">
								<thead>
									<tr>${headerHtml}</tr>
								</thead>
								<tbody>
									${rowsHtml || `<tr><td colspan="${columns.length}" style="border:1px solid #d1d5db;padding:8px;">No rows found.</td></tr>`}
								</tbody>
							</table>
						</div>
					</body>
				</html>
			`;

			const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
			const url = URL.createObjectURL(blob);

			const a = document.createElement('a');
			a.href = url;
			a.download = `outer-assignments-${new Date().toISOString().slice(0, 10)}.xls`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);

			URL.revokeObjectURL(url);
			setOk('Excel exported successfully');
		} catch (e: any) {
			setErr(e?.message || 'Excel export failed');
		} finally {
			setExcelExporting(false);
		}
	}

	const SortTh = ({ k, label }: { k: SortKey; label: string }) => {
		const active = sortKey === k;
		return (
			<th
				className="px-3 py-2 text-left text-xs font-semibold text-gray-700 cursor-pointer select-none whitespace-nowrap"
				onClick={() => sortBy(k)}
				title={`Sort by ${label}`}
			>
				<span className="inline-flex items-center gap-1">
					{label}
					{active ? (
						sortDir === 'asc' ? (
							<ChevronUp className="h-3.5 w-3.5" />
						) : (
							<ChevronDown className="h-3.5 w-3.5" />
						)
					) : null}
				</span>
			</th>
		);
	};

	const selectedVendorLabel = vendorId
		? (() => {
			const vendor = vendors.find((v) => v.id === vendorId);
			return vendor ? vendorLabel(vendor) : 'All TPA';
		})()
		: 'All TPA';

	const selectedStaffLabel = staffFilter
		? (() => {
			const staff = allUsers.find((u) => u.id === staffFilter) || users.find((u) => u.id === staffFilter);
			return staff ? userLabel(staff) : 'Selected Staff';
		})()
		: 'All Staff';

	function clearFilters() {
		setDateFrom('');
		setDateTo('');
		setStaffFilter('');
		setLabId('');
		setVendorId('');
		setVisitType('');
		setServiceType('');
		setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
	}

	const columnMenu =
		mounted && showColumnMenu
			? createPortal(
				<div
					ref={columnMenuRef}
					className="fixed z-[9999] rounded-lg border bg-white shadow-xl p-3"
					style={{
						top: menuPos.top,
						left: menuPos.left,
						width: menuPos.width,
						maxHeight: '320px',
					}}
				>
					<div className="flex items-center justify-between mb-2">
						<div className="text-sm font-semibold text-gray-800">Visible Columns</div>
						<button
							type="button"
							className="text-xs text-brand hover:underline"
							onClick={resetColumns}
						>
							Reset
						</button>
					</div>

					<div className="max-h-[250px] overflow-y-auto space-y-2 pr-1">
						{ALL_COLUMNS.map((col) => (
							<label
								key={col.key}
								className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
							>
								<input
									type="checkbox"
									checked={visibleColumns.includes(col.key)}
									onChange={() => toggleColumn(col.key)}
								/>
								<span>{col.label}</span>
							</label>
						))}
					</div>
				</div>,
				document.body
			)
			: null;

	return (
		<div className="mx-auto w-full max-w-[1700px] px-4 space-y-6">
			<div className="rounded-xl border bg-white px-5 py-4 shadow-sm flex items-start justify-between gap-4">
				<div className="flex items-start gap-3">
					<div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand-600">
						<CalendarDays className="h-5 w-5" />
					</div>
					<div>
						<h1 className="text-2xl md:text-3xl font-bold tracking-tight">Outer Appointment Assignment</h1>
						<div className="text-xs text-gray-500 mt-1">
							Range: <b>{dateFrom || '…'}</b> → <b>{dateTo || '…'}</b>
							{visitType ? (
								<span>
									{' '}
									· Visit: <b>{visitType}</b>
								</span>
							) : null}
							{serviceType ? (
								<span>
									{' '}
									· Service: <b>{serviceType}</b>
								</span>
							) : null}
							{vendorId ? (
								<span>
									{' '}
									· TPA: <b>{selectedVendorLabel}</b>
								</span>
							) : null}
							{staffFilter ? (
								<span>
									{' '}
									· Staff: <b>{selectedStaffLabel}</b>
								</span>
							) : null}
						</div>
					</div>
				</div>

				<div className="flex flex-col items-end gap-2">
					<div className="text-xs text-gray-600">
						<span className="inline-flex items-center gap-2 flex-wrap">
							<Users className="h-4 w-4" />
							Filtered rows: <b>{stats.total}</b> · Staff selected: <b>{stats.assigned}</b> · Modified rows:{' '}
							<b>{stats.changed}</b>
							{stats.missingRemark ? (
								<span className="text-red-600">
									{' '}
									· Missing remarks: <b>{stats.missingRemark}</b>
								</span>
							) : null}
						</span>
					</div>

					<div className="flex items-center gap-2 flex-wrap">
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
							onClick={exportExcel}
							disabled={loading || excelExporting}
							title="Export current filtered rows to Excel"
						>
							<FileSpreadsheet className="h-4 w-4" />
							{excelExporting ? 'Exporting…' : 'Export Excel'}
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
							disabled={loading || saving || filteredSortedRows.length === 0}
							title="Save only modified rows in current filter"
						>
							<Save className="h-4 w-4" />
							{saving ? 'Saving…' : 'Save All'}
						</button>
					</div>
				</div>
			</div>

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

			<div className="rounded-xl border bg-white shadow-sm overflow-visible">
				<div className="p-4 border-b space-y-3 overflow-visible">
					<div>
						<div className="text-base font-semibold">Assignment List</div>
						<div className="text-xs text-gray-600 mt-1">
							Fill <b>Staff</b> + <b>Address Remark</b>, then click <b>Save All</b>.
							<span className="ml-2 text-gray-500">(Save All = only modified rows in current filter)</span>
						</div>
					</div>

					<div className="flex flex-nowrap items-end gap-2 overflow-x-auto overflow-y-visible pb-1">
						<div className="shrink-0">
							<label className="block text-[11px] text-gray-600 mb-1">Lab</label>
							<select
								className="border rounded px-2 py-2 w-[115px] text-sm"
								value={labId}
								onChange={(e) => setLabId(e.target.value)}
							>
								<option value="">All Labs</option>
								{labs.map((l) => (
									<option key={l.id} value={l.id}>
										{l.nickName || l.name} {l.labCode ? `(${l.labCode})` : ''}
									</option>
								))}
							</select>
						</div>

						<div className="shrink-0">
							<label className="block text-[11px] text-gray-600 mb-1">TPA Name</label>
							<select
								className="border rounded px-2 py-2 w-[135px] text-sm"
								value={vendorId}
								onChange={(e) => setVendorId(e.target.value)}
							>
								<option value="">All TPA</option>
								{vendors.map((v) => (
									<option key={v.id} value={v.id}>
										{vendorLabel(v)}
									</option>
								))}
							</select>
						</div>

						<div className="shrink-0">
							<label className="block text-[11px] text-gray-600 mb-1">Staff</label>
							<select
								className="border rounded px-2 py-2 w-[145px] text-sm"
								value={staffFilter}
								onChange={(e) => setStaffFilter(e.target.value)}
							>
								<option value="">All Staff</option>
								{allUsers.map((u) => (
									<option key={u.id} value={u.id}>
										{userLabel(u)}
									</option>
								))}
							</select>
						</div>

						<div className="shrink-0">
							<label className="block text-[11px] text-gray-600 mb-1">Visit Type</label>
							<select
								className="border rounded px-2 py-2 w-[95px] text-sm"
								value={visitType}
								onChange={(e) => setVisitType(normalizeVisitType(e.target.value))}
							>
								<option value="">All</option>
								<option value="CENTER">Center</option>
								<option value="HOME">Home</option>
							</select>
						</div>

						<div className="shrink-0">
							<label className="block text-[11px] text-gray-600 mb-1">Service Type</label>
							<select
								className="border rounded px-2 py-2 w-[100px] text-sm"
								value={serviceType}
								onChange={(e) => setServiceType(normalizeServiceType(e.target.value))}
							>
								<option value="">All</option>
								<option value="OUTER">Outer</option>
								<option value="LOCAL">Local</option>
							</select>
						</div>

						<div className="shrink-0">
							<label className="block text-[11px] text-gray-600 mb-1">Date Range</label>
							<div className="flex items-center rounded border bg-white overflow-hidden h-[42px]">
								<input
									type="date"
									className="px-2 text-sm outline-none w-[130px] h-full"
									value={dateFrom}
									onChange={(e) => setDateFrom(e.target.value)}
								/>
								<div className="h-full w-px bg-gray-200" />
								<input
									type="date"
									className="px-2 text-sm outline-none w-[130px] h-full"
									value={dateTo}
									onChange={(e) => setDateTo(e.target.value)}
								/>
							</div>
						</div>

						<div className="relative shrink-0">
							<label className="block text-[11px] text-gray-600 mb-1">Select Column</label>
							<button
								ref={columnButtonRef}
								type="button"
								className="inline-flex items-center justify-between gap-2 border rounded px-3 py-2 w-[150px] text-sm hover:bg-gray-50 h-[42px] bg-white"
								onClick={() => {
									if (!showColumnMenu) updateColumnMenuPosition();
									setShowColumnMenu((p) => !p);
								}}
							>
								<span className="inline-flex items-center gap-2 truncate">
									<Columns3 className="h-4 w-4 shrink-0" />
									<span className="truncate">{visibleColumns.length} selected</span>
								</span>
								{showColumnMenu ? (
									<ChevronUp className="h-4 w-4 shrink-0" />
								) : (
									<ChevronDown className="h-4 w-4 shrink-0" />
								)}
							</button>
						</div>

						<div className="shrink-0">
							<label className="block text-[11px] text-gray-600 mb-1 opacity-0">Clear</label>
							<button
								type="button"
								className="inline-flex items-center justify-center rounded border h-[42px] w-[42px] hover:bg-gray-50"
								onClick={clearFilters}
								title="Clear filters"
							>
								<X className="h-4 w-4" />
							</button>
						</div>
					</div>
				</div>

				<div className="p-4">
					<div className="w-full overflow-x-auto">
						<div className="max-h-[620px] overflow-y-auto rounded border">
							<table className="w-full min-w-[1700px]">
								<thead className="sticky top-0 z-10 bg-white">
									<tr className="border-b bg-gray-50">
										{visibleColumnDefs.map((col) =>
											col.sortKey ? (
												<SortTh key={col.key} k={col.sortKey} label={col.label} />
											) : (
												<th
													key={col.key}
													className="px-3 py-2 text-left text-xs font-semibold text-gray-700 whitespace-nowrap"
												>
													{col.label}
												</th>
											),
										)}
									</tr>
								</thead>

								<tbody>
									{loading ? (
										<tr>
											<td colSpan={visibleColumnDefs.length} className="px-3 py-6 text-center text-sm text-gray-500">
												Loading…
											</td>
										</tr>
									) : filteredSortedRows.length === 0 ? (
										<tr>
											<td colSpan={visibleColumnDefs.length} className="px-3 py-6 text-center text-sm text-gray-500">
												No rows found for the current filter.
											</td>
										</tr>
									) : (
										filteredSortedRows.map((r) => {
											const assignedToId = getCurrentAssignedToId(r);
											const remark = draftRemark[r.id] ?? r.addressRemark ?? '';
											const vt = normalizeVisitType(r.visitType || '');
											const st = normalizeServiceType(r.serviceType || '');
											const changed = isRowChanged(r);
											const rowIsReportCompleted = isReportCompletedStatus(r.status);
											const assignedStaffName = getAssignedUserName(r);

											return (
												<tr
													key={r.id}
													className={`border-t hover:bg-gray-50 ${changed ? 'bg-amber-50/40' : ''}`}
												>
													{visibleColumns.includes('appointment') && (
														<td className="px-3 py-2 text-sm whitespace-nowrap">
															<div className="font-medium text-gray-900">
																{formatDateOnly(r.apptAt)}{' '}
																<span className="text-gray-500">{formatTime(r.apptAt)}</span>
															</div>
															{!labId && (
																<div className="text-xs text-gray-500">
																	{r.labNick || r.labCode || r.labName || r.labId}
																</div>
															)}
														</td>
													)}

													{visibleColumns.includes('clientName') && (
														<td className="px-3 py-2 text-sm whitespace-nowrap">{r.clientName}</td>
													)}

													{visibleColumns.includes('mobileNo') && (
														<td className="px-3 py-2 text-sm whitespace-nowrap">{r.mobileNo}</td>
													)}

													{visibleColumns.includes('insuranceName') && (
														<td className="px-3 py-2 text-sm">{r.insuranceName}</td>
													)}

													{visibleColumns.includes('testSummary') && (
														<td className="px-3 py-2 text-sm whitespace-nowrap">{r.testSummary}</td>
													)}

													{visibleColumns.includes('visitType') && (
														<td className="px-3 py-2 text-sm whitespace-nowrap">{vt || '-'}</td>
													)}

													{visibleColumns.includes('serviceType') && (
														<td className="px-3 py-2 text-sm whitespace-nowrap">{st || '-'}</td>
													)}

													{visibleColumns.includes('location') && (
														<td className="px-3 py-2 text-sm">{r.location}</td>
													)}

													{visibleColumns.includes('staff') && (
														<td className="px-3 py-2 text-sm min-w-[180px]">
															{rowIsReportCompleted ? (
																<div className="min-h-[36px] w-full rounded border border-gray-200 bg-gray-50 px-2 py-2 text-sm text-gray-800">
																	{assignedStaffName || 'Unassigned'}
																</div>
															) : (
																<select
																	className="w-full border rounded px-2 py-1.5 bg-white"
																	value={assignedToId}
																	onChange={(e) =>
																		setDraftAssignedTo((p) => ({ ...p, [r.id]: e.target.value }))
																	}
																>
																	<option value="">Select User</option>
																	{users.map((u) => (
																		<option key={u.id} value={u.id}>
																			{userLabel(u)}
																		</option>
																	))}
																</select>
															)}
														</td>
													)}

													{visibleColumns.includes('remark') && (
														<td className="px-3 py-2 text-sm min-w-[220px]">
															<input
																className="w-full border rounded px-2 py-1.5"
																placeholder="Enter address / landmark / remark"
																value={remark}
																onChange={(e) =>
																	setDraftRemark((p) => ({ ...p, [r.id]: e.target.value }))
																}
															/>
														</td>
													)}

													{visibleColumns.includes('status') && (
														<td className="px-3 py-2 text-sm whitespace-nowrap">
															<div>{r.status}</div>
															{changed ? (
																<div className="text-[11px] text-amber-700 font-medium mt-1">
																	Modified
																</div>
															) : null}
														</td>
													)}
												</tr>
											);
										})
									)}
								</tbody>
							</table>
						</div>
					</div>

					<div className="text-xs text-gray-500 mt-3">
						Export Excel uses the current filters and the currently selected columns. Export PNG uses the clean assignment template.
					</div>
				</div>
			</div>

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
						<span>
							{' '}
							· Range: <b>{dateFrom || '…'}</b> → <b>{dateTo || '…'}</b>
						</span>
						{visitType ? (
							<span>
								{' '}
								· Visit: <b>{visitType}</b>
							</span>
						) : null}
						{serviceType ? (
							<span>
								{' '}
								· Service: <b>{serviceType}</b>
							</span>
						) : null}
						{vendorId ? (
							<span>
								{' '}
								· TPA: <b>{selectedVendorLabel}</b>
							</span>
						) : null}
						{staffFilter ? (
							<span>
								{' '}
								· Staff: <b>{selectedStaffLabel}</b>
							</span>
						) : null}
						{labId ? (
							<span>
								{' '}
								· Lab:{' '}
								<b>
									{labs.find((l) => l.id === labId)?.nickName ||
										labs.find((l) => l.id === labId)?.name ||
										labId}
								</b>
							</span>
						) : (
							<span>
								{' '}
								· Lab: <b>All Labs</b>
							</span>
						)}
					</div>

					<div className="mt-4" style={{ borderTop: '2px solid #111', paddingTop: '12px' }}>
						{groupedForExport.length === 0 ? (
							<div className="text-sm text-gray-700">No rows to export.</div>
						) : (
							groupedForExport.map((g, idx) => {
								const assigneeNo = idx + 1;

								return (
									<div key={g.staffId} style={{ marginBottom: '24px' }}>
										<div className="text-base font-semibold">
											Assignee_{assigneeNo} : {g.staffName}
										</div>
										<div
											style={{
												borderTop: '1px solid #111',
												marginTop: '6px',
												marginBottom: '10px',
											}}
										/>

										{g.list.map((r) => {
											const address =
												(draftRemark[r.id] ?? r.addressRemark ?? '').trim() || (r.location || '');

											return (
												<div key={r.id} style={{ marginBottom: '12px' }}>
													<div className="text-sm">
														<span className="font-semibold">Appointment</span> :{' '}
														{formatDateOnly(r.apptAt)} {formatTime(r.apptAt)}
													</div>

													<div className="text-sm">
														<span className="font-semibold">Client Name</span> : {r.clientName || '-'}
													</div>

													<div className="text-sm">
														<span className="font-semibold">Client ID</span> : {r.clientRef || '-'}
													</div>

													<div className="text-sm">
														<span className="font-semibold">Test</span> : {r.testSummary || '-'}
													</div>

													<div className="text-sm">
														<span className="font-semibold">Insurance Company</span> :{' '}
														{r.insuranceName || '-'}
													</div>

													<div className="text-sm">
														<span className="font-semibold">Mobile No</span> : {r.mobileNo || '-'}
													</div>

													<div className="text-sm">
														<span className="font-semibold">Service Type</span> :{' '}
														{normalizeServiceType(r.serviceType || '') || '-'}
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

			{columnMenu}
		</div>
	);
}