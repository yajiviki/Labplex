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
function endOfDay(d: Date) {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function toYmd(d: Date) {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function POST(req: Request) {
	try {
		const { labId, vendorId, from, to } = await req.json();

		const fromDate = parseDateFlexible(from);
		const toStart = parseDateFlexible(to);
		if (!fromDate || !toStart) {
			return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
		}
		const toDate = endOfDay(toStart);

		// Base filter
		const whereBase: any = {
			isActive: 1,
			apptAt: { gte: fromDate, lte: toDate },
		};
		if (labId) whereBase.labId = labId;          // null/'' = all labs
		if (vendorId) whereBase.vendorId = vendorId; // null/'' = all tpa

		debugger;

		// ---- TABLE: group by Lab × TPA sum(extraChargeRs) ----
		const grouped = await prisma.appointment.groupBy({
			by: ['labId', 'vendorId'],
			where: {
				...whereBase,
				// count only where there is a number (NULLs ignored by SUM but nice to filter noise)
				extraChargeRs: { not: null },
			},
			_sum: { extraChargeRs: true },
			orderBy: [{ labId: 'asc' }, { vendorId: 'asc' }],
		});

		// Load display names for Lab and Vendor (TPA)
		const labIds = Array.from(new Set(grouped.map(g => g.labId).filter(Boolean))) as string[];
		const venIds = Array.from(new Set(grouped.map(g => g.vendorId).filter(Boolean))) as string[];

		const [labs, vendors] = await Promise.all([
			labIds.length ? prisma.lab.findMany({ where: { id: { in: labIds } }, select: { id: true, name: true } }) : Promise.resolve([]),
			venIds.length ? prisma.vendor.findMany({ where: { id: { in: venIds } }, select: { id: true, tpaName: true } }) : Promise.resolve([]),
		]);
		const labMap = new Map(labs.map(l => [l.id, l.name]));
		const venMap = new Map(vendors.map(v => [v.id, v.tpaName]));

		const table = grouped.map(g => ({
			labId: g.labId,
			labName: g.labId ? (labMap.get(g.labId) || '-') : '—',
			vendorId: g.vendorId,
			tpaName: g.vendorId ? (venMap.get(g.vendorId) || '-') : '—',
			totalExtra: Number(g._sum.extraChargeRs || 0),
		})).filter(r => r.totalExtra > 0);

		// ---- TREND: daily sum(extraChargeRs) over range (optionally filtered by labId/vendorId) ----
		const trend = await prisma.$queryRaw<
			{ d: Date; amt: any }[]
		>`
      WITH days AS (
        SELECT generate_series(${fromDate}::date, ${toDate}::date, '1 day')::date AS d
      ),
      base AS (
        SELECT date_trunc('day', "apptAt")::date AS d,
               SUM(COALESCE("extraChargeRs",0))::numeric AS amt
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

		return NextResponse.json({
			table,
			trend: trend.map(r => ({ date: toYmd(new Date(r.d)), amount: Number(r.amt) })),
		});
	} catch (e: any) {
		console.error('[reports/accounts] fatal:', e?.message, e?.stack);
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
