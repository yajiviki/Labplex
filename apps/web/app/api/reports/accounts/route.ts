import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// --- Normalizers ---
function normalizeServiceType(s?: string | null): 'Local' | 'Outer' | null {
	const v = (s || '').trim().toLowerCase();
	if (v === 'local' || v === 'l') return 'Local';
	if (v === 'outer' || v === 'o') return 'Outer';
	return null;
}
function normalizeVisitType(s?: string | null): 'HOME' | 'CENTER' | null {
	const v = (s || '').trim().toLowerCase();
	if (v === 'home' || v === 'h' || v === 'home visit') return 'HOME';
	if (v === 'center' || v === 'centre' || v === 'c' || v === 'center visit' || v === 'centre visit') return 'CENTER';
	return null;
}

function parseDateFlexible(s?: string) {
	if (!s) return null;
	let m = /^(\d{4})[-/](\d{2})[-/](\d{2})$/.exec(s);
	if (m) return new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0);
	m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
	if (m) return new Date(+m[3], +m[2] - 1, +m[1], 0, 0, 0, 0);
	return null;
}
function endOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999); }
function toYmd(d: Date) { const pad = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

// We consider these statuses as "report completed"
const COMPLETED_STATUSES = ['Report - Completed', 'Completed'];

export async function POST(req: Request) {
	try {
		const { labId, vendorId, from, to, pivotLabIds } = await req.json();

		const fromDate = parseDateFlexible(from);
		const toStart = parseDateFlexible(to);
		if (!fromDate || !toStart) return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
		const toDate = endOfDay(toStart);

		// Base filter for summary & trend
		const whereBase: any = { isActive: 1, apptAt: { gte: fromDate, lte: toDate } };
		if (labId) whereBase.labId = labId;
		if (vendorId) whereBase.vendorId = vendorId;

		// ===== SUMMARY: sums where extra exists =====
		const grouped = await prisma.appointment.groupBy({
			by: ['labId', 'vendorId'],
			where: { ...whereBase, extraChargeRs: { not: null } },
			_sum: { extraChargeRs: true },
			orderBy: [{ vendorId: 'asc' }, { labId: 'asc' }],
		});

		// ===== SUMMARY: “no extra” (null OR 0) counts per pair =====
		const missing = await prisma.appointment.groupBy({
			by: ['labId', 'vendorId'],
			where: { ...whereBase, OR: [{ extraChargeRs: null }, { extraChargeRs: 0 }] },
			_count: { _all: true },
		});

		// Build union of keys so rows with only "missing" still appear
		const keyOf = (l: string | null, v: string | null) => `${l ?? ''}__${v ?? ''}`;
		const sumMap = new Map<string, number>();
		for (const g of grouped) sumMap.set(keyOf(g.labId, g.vendorId), Number(g._sum.extraChargeRs || 0));
		const missingMap = new Map<string, number>();
		for (const m of missing) missingMap.set(keyOf(m.labId, m.vendorId), Number(m._count._all || 0));

		const allKeys = new Set<string>([...Array.from(sumMap.keys()), ...Array.from(missingMap.keys())]);
		const ids = Array.from(allKeys).map(k => {
			const [l, v] = k.split('__');
			return { labId: l || null, vendorId: v || null };
		});

		// names + nick names
		const labIds = Array.from(new Set(ids.map(x => x.labId).filter(Boolean)));
		const venIds = Array.from(new Set(ids.map(x => x.vendorId).filter(Boolean)));
		const [labs, vendors] = await Promise.all([
			labIds.length ? prisma.lab.findMany({ where: { id: { in: labIds } }, select: { id: true, name: true, nickName: true } }) : Promise.resolve([]),
			venIds.length ? prisma.vendor.findMany({ where: { id: { in: venIds } }, select: { id: true, tpaName: true, nickName: true } }) : Promise.resolve([]),
		]);
		const labMap = new Map(labs.map(l => [l.id, { name: l.name, nick: l.nickName }]));
		const venMap = new Map(vendors.map(v => [v.id, { name: v.tpaName, nick: v.nickName }]));

		const table = ids.map(({ labId, vendorId }) => {
			const k = keyOf(labId, vendorId);
			const totalExtra = Number(sumMap.get(k) || 0);
			const missingExtraCount = Number(missingMap.get(k) || 0);
			return {
				labId,
				labName: labId ? (labMap.get(labId)?.name || '-') : '—',
				labNickName: labId ? (labMap.get(labId)?.nick ?? null) : null,
				vendorId,
				tpaName: vendorId ? (venMap.get(vendorId)?.name || '-') : '—',
				tpaNickName: vendorId ? (venMap.get(vendorId)?.nick ?? null) : null,
				totalExtra,
				missingExtraCount,
			};
		}).sort((a, b) =>
			(a.vendorId ?? '').localeCompare(b.vendorId ?? '') || (a.labId ?? '').localeCompare(b.labId ?? '')
		);

		// ===== TREND (extra per day) =====
		const trend = await prisma.$queryRaw<{ d: Date; amt: any }[]>`
      WITH days AS ( SELECT generate_series(${fromDate}::date, ${toDate}::date, '1 day')::date AS d ),
      base AS (
        SELECT date_trunc('day', "apptAt")::date AS d,
               SUM(COALESCE("extraChargeRs",0))::numeric AS amt
        FROM "Appointment"
        WHERE "isActive" = 1
          AND "apptAt" >= ${fromDate} AND "apptAt" <= ${toDate}
          AND (${labId}::text IS NULL OR "labId" = ${labId})
          AND (${vendorId}::text IS NULL OR "vendorId" = ${vendorId})
        GROUP BY 1
      )
      SELECT d.d, COALESCE(b.amt, 0) AS amt
      FROM days d
      LEFT JOIN base b ON b.d = d.d
      ORDER BY d.d;`;

		// ===== PIVOT (only Report Completed) — normalized, no gender =====
		const serviceTypes: ('Local' | 'Outer')[] = ['Local', 'Outer'];
		const visits: ('HOME' | 'CENTER')[] = ['HOME', 'CENTER'];

		const pivotWhere: any = {
			isActive: 1,
			apptAt: { gte: fromDate, lte: toDate },
			status: { in: COMPLETED_STATUSES },            // <<<<<<<<<< ONLY completed
			...(Array.isArray(pivotLabIds) && pivotLabIds.length ? { labId: { in: pivotLabIds } } : {}),
			...(labId ? { labId } : {}),
			...(vendorId ? { vendorId } : {}),
		};

		const raw = await prisma.appointment.findMany({
			where: pivotWhere,
			select: { labId: true, vendorId: true, serviceType: true, visitType: true },
		});

		const plabIds = Array.from(new Set(raw.map(r => r.labId).filter(Boolean) as string[]));
		const pvenIds = Array.from(new Set(raw.map(r => r.vendorId).filter(Boolean) as string[]));
		const [plabs, pvens] = await Promise.all([
			plabIds.length ? prisma.lab.findMany({ where: { id: { in: plabIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
			pvenIds.length ? prisma.vendor.findMany({ where: { id: { in: pvenIds } }, select: { id: true, tpaName: true } }) : Promise.resolve([]),
		]);
		const pLabName = new Map(plabs.map(l => [l.id, l.name]));
		const pVenName = new Map(pvens.map(v => [v.id, v.tpaName]));

		type PivotRowInternal = {
			vendorId: string | null;
			labId: string | null;
			tpaName: string;
			labName: string;
			localTotal: number;
			outerTotal: number;
			rowTotal: number;
			cells: Record<string, number>;
		};

		const rowsMap = new Map<string, PivotRowInternal>();
		const columnTotals: Record<string, number> = {};

		const ensureRow = (vendorIdVal: string | null, labIdVal: string | null): PivotRowInternal => {
			const key = `${vendorIdVal ?? ''}__${labIdVal ?? ''}`;
			if (!rowsMap.has(key)) {
				const cells: Record<string, number> = {};
				for (const st of serviceTypes) for (const vt of visits) cells[`${st}__${vt}`] = 0;
				rowsMap.set(key, {
					vendorId: vendorIdVal,
					labId: labIdVal,
					tpaName: vendorIdVal ? (pVenName.get(vendorIdVal) || '-') : '—',
					labName: labIdVal ? (pLabName.get(labIdVal) || '-') : '—',
					localTotal: 0,
					outerTotal: 0,
					rowTotal: 0,
					cells,
				});
			}
			return rowsMap.get(key)!;
		};

		for (const r of raw) {
			const st = normalizeServiceType(r.serviceType);
			const vt = normalizeVisitType(r.visitType);

			const row = ensureRow(r.vendorId ?? null, r.labId ?? null);

			if (st && vt) {
				const k = `${st}__${vt}`;
				row.cells[k] = (row.cells[k] ?? 0) + 1;
				columnTotals[k] = (columnTotals[k] ?? 0) + 1;
				if (st === 'Local') row.localTotal += 1;
				if (st === 'Outer') row.outerTotal += 1;
			}
			row.rowTotal += 1;
		}

		for (const st of serviceTypes) for (const vt of visits) {
			const k = `${st}__${vt}`;
			if (!(k in columnTotals)) columnTotals[k] = 0;
		}

		const rows = Array.from(rowsMap.values());
		const totalLocal = rows.reduce((s, r) => s + r.localTotal, 0);
		const totalOuter = rows.reduce((s, r) => s + r.outerTotal, 0);
		const grandTotal = totalLocal + totalOuter;

		return NextResponse.json({
			table,
			trend: trend.map(r => ({ date: toYmd(new Date(r.d)), amount: Number(r.amt) })),
			pivot: { serviceTypes, visits, rows, totalLocal, totalOuter, grandTotal, columnTotals },
		});
	} catch (e: any) {
		console.error('[reports/accounts] fatal:', e?.message, e?.stack);
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
