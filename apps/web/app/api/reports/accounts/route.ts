import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseDateFlexible(s?: string) {
	if (!s) return null;
	let m = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
	if (m) return new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0);
	m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
	if (m) return new Date(+m[3], +m[2] - 1, +m[1], 0, 0, 0, 0);
	return null;
}
function endOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999); }
function toYmd(d: Date) { const pad = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

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

		const allKeys = new Set<string>([...sumMap.keys(), ...missingMap.keys()]);
		const ids = Array.from(allKeys).map(k => {
			const [l, v] = k.split('__');
			return { labId: l || null, vendorId: v || null };
		});

		// names + nick names
		const labIds = Array.from(new Set(ids.map(x => x.labId).filter(Boolean))) as string[];
		const venIds = Array.from(new Set(ids.map(x => x.vendorId).filter(Boolean))) as string[];
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

		// ===== PIVOT (counts) with multi-lab filter (same as before) =====
		const serviceTypes = ['Local', 'Outer'];
		const visits = ['HOME', 'CENTER'];
		const genders = ['Male', 'Female'];

		const pivotWhere: any = {
			isActive: 1,
			apptAt: { gte: fromDate, lte: toDate },
			...(Array.isArray(pivotLabIds) && pivotLabIds.length ? { labId: { in: pivotLabIds } } : {}),
		};

		const raw = await prisma.appointment.findMany({
			where: pivotWhere,
			select: { labId: true, vendorId: true, serviceType: true, visitType: true, gender: true },
		});

		const plabIds = Array.from(new Set(raw.map(r => r.labId).filter(Boolean))) as string[];
		const pvenIds = Array.from(new Set(raw.map(r => r.vendorId).filter(Boolean))) as string[];
		const [plabs, pvens] = await Promise.all([
			plabIds.length ? prisma.lab.findMany({ where: { id: { in: plabIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
			pvenIds.length ? prisma.vendor.findMany({ where: { id: { in: pvenIds } }, select: { id: true, tpaName: true } }) : Promise.resolve([]),
		]);
		const pLabName = new Map(plabs.map(l => [l.id, l.name]));
		const pVenName = new Map(pvens.map(v => [v.id, v.tpaName]));

		type K = string;
		const key = (v: string | null, l: string | null, st: string | null, vt: string | null, g: string | null): K =>
			`${v ?? ''}__${l ?? ''}__${st ?? ''}__${vt ?? ''}__${g ?? ''}`;
		const counts = new Map<K, number>();
		const rowPairs = new Set<string>();

		for (const r of raw) {
			rowPairs.add(`${r.vendorId ?? ''}__${r.labId ?? ''}`);
			if (!r.serviceType || !r.visitType || !r.gender) continue;
			const k = key(r.vendorId, r.labId, r.serviceType, r.visitType, r.gender);
			counts.set(k, (counts.get(k) || 0) + 1);
		}

		const rows: any[] = [];
		for (const pair of rowPairs) {
			const [vId, lId] = pair.split('__');
			const vendorIdStr = vId || null;
			const labIdStr = lId || null;

			const cells: Record<string, number> = {};
			let localTotal = 0, outerTotal = 0;

			for (const st of serviceTypes) for (const vt of visits) for (const g of genders) {
				const c = counts.get(key(vendorIdStr, labIdStr, st, vt, g)) || 0;
				cells[`${st}__${vt}__${g}`] = c;
				if (st === 'Local') localTotal += c;
				else if (st === 'Outer') outerTotal += c;
			}

			rows.push({
				vendorId: vendorIdStr,
				tpaName: vendorIdStr ? (pVenName.get(vendorIdStr) || '-') : '—',
				labId: labIdStr,
				labName: labIdStr ? (pLabName.get(labIdStr) || '-') : '—',
				localTotal,
				outerTotal,
				rowTotal: localTotal + outerTotal,
				cells,
			});
		}

		const columnTotals: Record<string, number> = {};
		for (const st of serviceTypes) for (const vt of visits) for (const g of genders) {
			const colKey = `${st}__${vt}__${g}`;
			columnTotals[colKey] = rows.reduce((s, r) => s + (r.cells[colKey] || 0), 0);
		}
		const totalLocal = rows.reduce((s, r) => s + (r.localTotal || 0), 0);
		const totalOuter = rows.reduce((s, r) => s + (r.outerTotal || 0), 0);
		const grandTotal = totalLocal + totalOuter;

		return NextResponse.json({
			table,
			trend: trend.map(r => ({ date: toYmd(new Date(r.d)), amount: Number(r.amt) })),
			pivot: { serviceTypes, visits, genders, rows, totalLocal, totalOuter, grandTotal, columnTotals },
		});
	} catch (e: any) {
		console.error('[reports/accounts] fatal:', e?.message, e?.stack);
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
