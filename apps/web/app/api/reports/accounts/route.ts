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

function endOfDay(d: Date) {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function toYmd(d: Date) {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toNum(v: unknown): number {
	if (v === null || v === undefined) return 0;
	if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
	if (typeof v === 'string') {
		const n = Number(v);
		return Number.isFinite(n) ? n : 0;
	}
	if (typeof v === 'object' && v && typeof (v as any).toNumber === 'function') {
		const n = (v as any).toNumber();
		return typeof n === 'number' && Number.isFinite(n) ? n : 0;
	}
	const n = Number(v as any);
	return Number.isFinite(n) ? n : 0;
}

// We consider these statuses as "report completed"
const COMPLETED_STATUSES = ['Report - Completed', 'Completed'];

type SummaryCardPayload = {
	totalCompletedCases: number;
	totalTravelAmount: number;
	totalTestAmount: number;
	totalReceivedAmount: number;
};

export async function POST(req: Request) {
	try {
		const { labId, vendorId, from, to, pivotLabIds } = await req.json();

		const fromDate = parseDateFlexible(from);
		const toStart = parseDateFlexible(to);
		if (!fromDate || !toStart) {
			return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
		}
		const toDate = endOfDay(toStart);

		// Base filter for summary & trend
		const whereBase: any = {
			isActive: 1,
			apptAt: { gte: fromDate, lte: toDate },
		};
		if (labId) whereBase.labId = labId;
		if (vendorId) whereBase.vendorId = vendorId;

		// ===== SUMMARY SOURCE =====
		// Pull appointments once so we can calculate:
		// 1. Travel total
		// 2. Test total
		// 3. Combined total
		// 4. Missing extra count
		// 5. Cards
		const summaryRows = await prisma.appointment.findMany({
			where: whereBase,
			select: {
				labId: true,
				vendorId: true,
				status: true,
				extraChargeRs: true,
				testAmountRs: true,
			},
			orderBy: [{ vendorId: 'asc' }, { labId: 'asc' }],
			take: 500000,
		});

		const keyOf = (l: string | null, v: string | null) => `${l ?? ''}__${v ?? ''}`;

		const aggMap = new Map<string, {
			labId: string | null;
			vendorId: string | null;
			totalExtra: number;
			totalTestAmount: number;
			totalAmount: number;
			missingExtraCount: number;
		}>();

		let totalCompletedCases = 0;
		let totalTravelAmount = 0;
		let totalTestAmount = 0;
		let totalReceivedAmount = 0;

		for (const r of summaryRows) {
			const travel = toNum(r.extraChargeRs);
			const test = toNum(r.testAmountRs);
			const total = travel + test;

			const k = keyOf(r.labId ?? null, r.vendorId ?? null);
			const cur = aggMap.get(k) ?? {
				labId: r.labId ?? null,
				vendorId: r.vendorId ?? null,
				totalExtra: 0,
				totalTestAmount: 0,
				totalAmount: 0,
				missingExtraCount: 0,
			};

			cur.totalExtra += travel;
			cur.totalTestAmount += test;
			cur.totalAmount += total;
			if (travel <= 0) cur.missingExtraCount += 1;

			aggMap.set(k, cur);

			totalTravelAmount += travel;
			totalTestAmount += test;
			totalReceivedAmount += total;

			if (COMPLETED_STATUSES.includes(String(r.status || '').trim())) {
				totalCompletedCases += 1;
			}
		}

		const ids = Array.from(aggMap.values()).map(x => ({
			labId: x.labId,
			vendorId: x.vendorId,
		}));

		const labIds = Array.from(new Set(ids.map(x => x.labId).filter(Boolean)));
		const venIds = Array.from(new Set(ids.map(x => x.vendorId).filter(Boolean)));

		const [labs, vendors] = await Promise.all([
			labIds.length
				? prisma.lab.findMany({
					where: { id: { in: labIds } },
					select: { id: true, name: true, nickName: true },
				})
				: Promise.resolve([]),
			venIds.length
				? prisma.vendor.findMany({
					where: { id: { in: venIds } },
					select: { id: true, tpaName: true, nickName: true },
				})
				: Promise.resolve([]),
		]);

		const labMap = new Map(labs.map(l => [l.id, { name: l.name, nick: l.nickName }]));
		const venMap = new Map(vendors.map(v => [v.id, { name: v.tpaName, nick: v.nickName }]));

		const table = Array.from(aggMap.values())
			.map((r) => ({
				labId: r.labId,
				labName: r.labId ? (labMap.get(r.labId)?.name || '-') : '—',
				labNickName: r.labId ? (labMap.get(r.labId)?.nick ?? null) : null,
				vendorId: r.vendorId,
				tpaName: r.vendorId ? (venMap.get(r.vendorId)?.name || '-') : '—',
				tpaNickName: r.vendorId ? (venMap.get(r.vendorId)?.nick ?? null) : null,
				totalExtra: r.totalExtra,
				totalTestAmount: r.totalTestAmount,
				totalAmount: r.totalAmount,
				missingExtraCount: r.missingExtraCount,
			}))
			.sort((a, b) =>
				(a.vendorId ?? '').localeCompare(b.vendorId ?? '') ||
				(a.labId ?? '').localeCompare(b.labId ?? '')
			);

		const cards: SummaryCardPayload = {
			totalCompletedCases,
			totalTravelAmount,
			totalTestAmount,
			totalReceivedAmount,
		};

		// ===== TREND (travel + test per day) =====
		const trend = await prisma.$queryRaw<{ d: Date; amt: any }[]>`
      WITH days AS (
        SELECT generate_series(${fromDate}::date, ${toDate}::date, '1 day')::date AS d
      ),
      base AS (
        SELECT
          date_trunc('day', "apptAt")::date AS d,
          SUM(COALESCE("extraChargeRs", 0) + COALESCE("testAmountRs", 0))::numeric AS amt
        FROM "Appointment"
        WHERE "isActive" = 1
          AND "apptAt" >= ${fromDate}
          AND "apptAt" <= ${toDate}
          AND (${labId}::text IS NULL OR "labId" = ${labId})
          AND (${vendorId}::text IS NULL OR "vendorId" = ${vendorId})
        GROUP BY 1
      )
      SELECT d.d, COALESCE(b.amt, 0) AS amt
      FROM days d
      LEFT JOIN base b ON b.d = d.d
      ORDER BY d.d;
    `;

		// ===== PIVOT (only Report Completed) — normalized, no gender =====
		const serviceTypes: ('Local' | 'Outer')[] = ['Local', 'Outer'];
		const visits: ('HOME' | 'CENTER')[] = ['HOME', 'CENTER'];

		const pivotWhere: any = {
			isActive: 1,
			apptAt: { gte: fromDate, lte: toDate },
			status: { in: COMPLETED_STATUSES },
			...(Array.isArray(pivotLabIds) && pivotLabIds.length ? { labId: { in: pivotLabIds } } : {}),
			...(labId ? { labId } : {}),
			...(vendorId ? { vendorId } : {}),
		};

		const raw = await prisma.appointment.findMany({
			where: pivotWhere,
			select: {
				labId: true,
				vendorId: true,
				serviceType: true,
				visitType: true,
			},
		});

		const plabIds = Array.from(new Set(raw.map(r => r.labId).filter(Boolean) as string[]));
		const pvenIds = Array.from(new Set(raw.map(r => r.vendorId).filter(Boolean) as string[]));

		const [plabs, pvens] = await Promise.all([
			plabIds.length
				? prisma.lab.findMany({
					where: { id: { in: plabIds } },
					select: { id: true, name: true },
				})
				: Promise.resolve([]),
			pvenIds.length
				? prisma.vendor.findMany({
					where: { id: { in: pvenIds } },
					select: { id: true, tpaName: true },
				})
				: Promise.resolve([]),
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
				for (const st of serviceTypes) {
					for (const vt of visits) {
						cells[`${st}__${vt}`] = 0;
					}
				}
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

		for (const st of serviceTypes) {
			for (const vt of visits) {
				const k = `${st}__${vt}`;
				if (!(k in columnTotals)) columnTotals[k] = 0;
			}
		}

		const rows = Array.from(rowsMap.values());
		const totalLocal = rows.reduce((s, r) => s + r.localTotal, 0);
		const totalOuter = rows.reduce((s, r) => s + r.outerTotal, 0);
		const grandTotal = totalLocal + totalOuter;

		return NextResponse.json({
			cards,
			table,
			trend: trend.map(r => ({ date: toYmd(new Date(r.d)), amount: Number(r.amt) })),
			pivot: { serviceTypes, visits, rows, totalLocal, totalOuter, grandTotal, columnTotals },
		});
	} catch (e: any) {
		console.error('[reports/accounts] fatal:', e?.message, e?.stack);
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}