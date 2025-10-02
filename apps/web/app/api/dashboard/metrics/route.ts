import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // useful while debugging to avoid caching

function parseDateFlexible(s?: string) {
	if (!s) return null;
	let m = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/); // yyyy-mm-dd or yyyy/mm/dd
	if (m) return new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0);
	m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/); // dd-mm-yyyy
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

// ✅ Active rows only (schema expects Int, NOT NULL)
const ACTIVE = { isActive: 1 } as const;

// tiny helper so a single bad filter won't 500 the whole route
async function safeCount(where: any, label: string) {
	try {
		return await prisma.appointment.count({ where });
	} catch (e: any) {
		console.error('[metrics.count failed]', label, e?.message, { where });
		return 0;
	}
}

export async function POST(req: Request) {
	try {
		const { labId, from, to } = await req.json();

		const fromDate = parseDateFlexible(from);
		const toStart = parseDateFlexible(to);
		if (!fromDate || !toStart) {
			return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
		}
		const toDate = endOfDay(toStart);

		// Base where: active rows; optionally filter lab
		const whereBase: any = { ...ACTIVE };
		if (labId) whereBase.labId = labId;

		// ----------------- TILES -----------------
		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);
		const todayEnd = new Date();
		todayEnd.setHours(23, 59, 59, 999);

		const TBI = ['TBI'];
		const SUBMITTED = ['Submitted', 'Submited', 'Report - Submitted'];
		const COMPLETED = ['Completed', 'Report - Completed'];
		const INPROGRESS = [
			'Waiting for response',
			'Not Responding',
			'Rescheduled',
			'Need Confirmation',
			'On hold',
		];
		const TOTAL = ['Cancelled', ...TBI, ...INPROGRESS];

		// Upcoming: future-dated & not-final (empty/NULL/TBI/in-progress)
		const now = new Date();
		const upcomingWhere = {
			...whereBase,
			apptAt: { gt: now },
			OR: [{ status: null }, { status: '' }, { status: { in: [...TBI, ...INPROGRESS] } }],
		};

		const [
			todays,
			upcoming,
			closed, // using "COMPLETED" as your 'closed' basis (same as before)
			totalInRange,
			submittedInRange,
			uploadPending, // NOTE: your original logic counted submitted; keeping as-is
		] = await Promise.all([
			safeCount({ ...whereBase, apptAt: { gte: todayStart, lte: todayEnd } }, 'todays'),
			safeCount(upcomingWhere, 'upcoming'),
			safeCount(
				{ ...whereBase, apptAt: { gte: fromDate, lte: toDate }, status: { in: COMPLETED } },
				'completedInRange',
			),
			safeCount(
				{ ...whereBase, apptAt: { gte: fromDate, lte: toDate }, status: { notIn: TOTAL } },
				'totalInRange',
			),
			safeCount(
				{ ...whereBase, apptAt: { gte: fromDate, lte: toDate }, status: { in: SUBMITTED } },
				'submittedInRange',
			),
			safeCount(
				{ ...whereBase, apptAt: { gte: fromDate, lte: toDate }, status: { in: SUBMITTED } },
				'uploadPending',
			),
		]);

		const totals = {
			todays,
			upcoming,
			uploadPending,
			outOfTat: 0,
			totalInRange: `${submittedInRange} / ${totalInRange}`,
			closed,
		};

		// ----------------- CHART 1: APPOINTMENT TREND -----------------
		const a_TBI = ['TBI'];
		const a_OnHold = ['On hold'];
		const a_MedDone = ['Medical Done'];
		const a_Cancelled = ['Cancelled'];

		const appointments = await prisma.$queryRaw<
			{ d: Date; tbi: bigint; onhold: bigint; med: bigint; canc: bigint }[]
		>`
      WITH days AS (
        SELECT generate_series(${fromDate}::date, ${toDate}::date, '1 day')::date AS d
      ),
      base AS (
        SELECT date_trunc('day', "apptAt")::date AS d,
               COUNT(*) FILTER (WHERE "status" = ANY(${a_TBI}))::bigint       AS tbi,
               COUNT(*) FILTER (WHERE "status" = ANY(${a_OnHold}))::bigint     AS onhold,
               COUNT(*) FILTER (WHERE "status" = ANY(${a_MedDone}))::bigint    AS med,
               COUNT(*) FILTER (WHERE "status" = ANY(${a_Cancelled}))::bigint  AS canc
        FROM "Appointment"
        WHERE "isActive" = 1
          AND (${labId}::text IS NULL OR "labId" = ${labId})
          AND "apptAt" >= ${fromDate}
          AND "apptAt" <= ${toDate}
        GROUP BY 1
      )
      SELECT d.d,
             COALESCE(b.tbi,0)    AS tbi,
             COALESCE(b.onhold,0) AS onhold,
             COALESCE(b.med,0)    AS med,
             COALESCE(b.canc,0)   AS canc
      FROM days d
      LEFT JOIN base b ON b.d = d.d
      ORDER BY d.d;
    `;

		// ----------------- CHART 2: IN-PROGRESS TREND -----------------
		const ip_Waiting = ['Waiting for response'];
		const ip_NotResp = ['Not Responding'];
		const ip_Resch = ['Rescheduled'];
		const ip_NeedConf = ['Need Confirmation'];

		const inprogress = await prisma.$queryRaw<
			{ d: Date; waiting: bigint; notresp: bigint; resch: bigint; need: bigint }[]
		>`
      WITH days AS (
        SELECT generate_series(${fromDate}::date, ${toDate}::date, '1 day')::date AS d
      ),
      base AS (
        SELECT date_trunc('day', "apptAt")::date AS d,
               COUNT(*) FILTER (WHERE "status" = ANY(${ip_Waiting}))::bigint AS waiting,
               COUNT(*) FILTER (WHERE "status" = ANY(${ip_NotResp}))::bigint  AS notresp,
               COUNT(*) FILTER (WHERE "status" = ANY(${ip_Resch}))::bigint    AS resch,
               COUNT(*) FILTER (WHERE "status" = ANY(${ip_NeedConf}))::bigint AS need
        FROM "Appointment"
        WHERE "isActive" = 1
          AND (${labId}::text IS NULL OR "labId" = ${labId})
          AND "apptAt" >= ${fromDate}
          AND "apptAt" <= ${toDate}
        GROUP BY 1
      )
      SELECT d.d,
             COALESCE(b.waiting,0) AS waiting,
             COALESCE(b.notresp,0) AS notresp,
             COALESCE(b.resch,0)   AS resch,
             COALESCE(b.need,0)    AS need
      FROM days d
      LEFT JOIN base b ON b.d = d.d
      ORDER BY d.d;
    `;

		// ----------------- CHART 3: REPORTS TREND -----------------
		// OnProcess = OnProcess OR Report - InProgress
		// Completed = Completed OR Report - Completed
		// Submitted = Submitted | Submited | Report - Submitted
		const r_OnProcess = ['OnProcess', 'Report - InProgress'];
		const r_Completed = ['Completed', 'Report - Completed'];
		const r_Submitted = ['Submitted', 'Submited', 'Report - Submitted'];

		const reports = await prisma.$queryRaw<
			{ d: Date; onproc: bigint; compl: bigint; subm: bigint }[]
		>`
      WITH days AS (
        SELECT generate_series(${fromDate}::date, ${toDate}::date, '1 day')::date AS d
      ),
      base AS (
        SELECT date_trunc('day', "apptAt")::date AS d,
               COUNT(*) FILTER (WHERE "status" = ANY(${r_OnProcess}))::bigint AS onproc,
               COUNT(*) FILTER (WHERE "status" = ANY(${r_Completed}))::bigint AS compl,
               COUNT(*) FILTER (WHERE "status" = ANY(${r_Submitted}))::bigint AS subm
        FROM "Appointment"
        WHERE "isActive" = 1
          AND (${labId}::text IS NULL OR "labId" = ${labId})
          AND "apptAt" >= ${fromDate}
          AND "apptAt" <= ${toDate}
        GROUP BY 1
      )
      SELECT d.d,
             COALESCE(b.onproc,0) AS onproc,
             COALESCE(b.compl,0)  AS compl,
             COALESCE(b.subm,0)   AS subm
      FROM days d
      LEFT JOIN base b ON b.d = d.d
      ORDER BY d.d;
    `;

		return NextResponse.json({
			totals,
			charts: {
				appointments: appointments.map((r) => ({
					date: toYmd(new Date(r.d)),
					TBI: Number(r.tbi),
					OnHold: Number(r.onhold),
					MedicalDone: Number(r.med),
					Cancelled: Number(r.canc),
				})),
				inprogress: inprogress.map((r) => ({
					date: toYmd(new Date(r.d)),
					Waiting: Number(r.waiting),
					NotResponding: Number(r.notresp),
					Rescheduled: Number(r.resch),
					NeedConfirmation: Number(r.need),
				})),
				reports: reports.map((r) => ({
					date: toYmd(new Date(r.d)),
					OnProcess: Number(r.onproc),
					Completed: Number(r.compl),
					Submitted: Number(r.subm),
				})),
			},
		});
	} catch (e: any) {
		console.error('[metrics] fatal:', e?.message, e?.stack);
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
