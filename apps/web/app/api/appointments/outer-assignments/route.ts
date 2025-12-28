// app/api/appointments/outer-assignments/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

/* ---------- date helpers (same style as your appointments route) ---------- */
function parseDateOnlyStart(v?: string | null) {
	if (!v) return null;
	const a = v.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
	if (a) return new Date(+a[1], +a[2] - 1, +a[3], 0, 0, 0, 0);
	const b = v.match(/^(\d{2})-(\d{2})-(\d{4})$/);
	if (b) return new Date(+b[3], +b[2] - 1, +b[1], 0, 0, 0, 0);
	const d = new Date(v);
	return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date) {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function isoOrNull(d?: Date | null) {
	return d ? new Date(d).toISOString() : null;
}

function normalizeVisitType(v?: string | null) {
	const s = (v || '').trim().toUpperCase();
	if (s === 'CENTER') return 'CENTER';
	if (s === 'HOME') return 'HOME';
	return '';
}

function buildTestSummary(t?: {
	bloodTest?: string | null;
	urineTest?: boolean | null;
	ecg?: boolean | null;
	tmt?: boolean | null;
	applicationForm?: string | null;
}) {
	if (!t) return '';
	const parts: string[] = [];
	const bt = (t.bloodTest || '').toUpperCase();
	if (bt && bt !== 'NO') parts.push(bt);
	if (t.urineTest) parts.push('U');
	if (t.ecg) parts.push('ECG');
	if (t.tmt) parts.push('TMT');
	const af = (t.applicationForm || '').toUpperCase();
	if (af) parts.push(af);
	return parts.join(',');
}

function getRole(session: any): string {
	return String(session?.user?.role ?? session?.role ?? '').toUpperCase();
}

function getLabId(session: any): string | null {
	return (session?.labId as string) || (session?.user?.labId as string) || null;
}

/* ----------------------------------------------------------------------- */
/* GET /api/appointments/outer-assignments?labId=&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD&visitType=CENTER|HOME */
/* ----------------------------------------------------------------------- */
export async function GET(req: Request) {
	try {
		const session = await auth();
		if (!session) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const role = getRole(session);
		const sessionLabId = getLabId(session);

		const { searchParams } = new URL(req.url);
		const labIdParam = (searchParams.get('labId') || '').trim();
		const dateFrom = searchParams.get('dateFrom');
		const dateTo = searchParams.get('dateTo');
		const visitType = normalizeVisitType(searchParams.get('visitType'));

		const isSuperAdmin = role === 'SUPER_ADMIN';

		// lab scoping
		let effectiveLabId: string | null = null;
		if (isSuperAdmin) {
			effectiveLabId = labIdParam ? labIdParam : null; // empty => all labs
		} else {
			// non-super admin always scoped to their lab
			effectiveLabId = sessionLabId;
		}

		// build appointment filter
		const where: any = {
			isActive: 1,
			// your requirement: serviceType Outer + status Need confirmation / Confirmed
			serviceType: { in: ['Outer', 'Local'], mode: 'insensitive' },
			status: { in: ['TBI', 'Need Confirmation', 'Need confirmation', 'Confirmed', 'CONFIRMED', 'confirmed'] },
		};

		if (effectiveLabId) where.labId = effectiveLabId;

		if (dateFrom || dateTo) {
			const gte = dateFrom ? parseDateOnlyStart(dateFrom) : null;
			const lte = dateTo ? endOfDay(parseDateOnlyStart(dateTo)!) : null;
			if (gte || lte) {
				where.apptAt = {};
				if (gte) where.apptAt.gte = gte;
				if (lte) where.apptAt.lte = lte;
			}
		}

		if (visitType) {
			where.visitType = visitType; // expects stored values CENTER/HOME
		}

		// ✅ users: show only USER role across ALL labs (no SUPER_ADMIN/ADMIN/STAFF)
		// keep simple: role equals USER (common in your app)
		const users = await prisma.user.findMany({
			where: {
				isActive: 1,
				role: { in: ['USER', 'user'] },
			},
			orderBy: { name: 'asc' },
			select: {
				id: true,
				name: true,
				userId: true,
				phone: true,
				role: true,
				labId: true,
				lab: { select: { name: true, nickName: true, labCode: true } },
			},
		});

		const appts = await prisma.appointment.findMany({
			where,
			orderBy: { apptAt: 'asc' },
			select: {
				id: true,
				labId: true,
				apptAt: true,
				clientName: true,
				phone: true,
				location: true,
				status: true,
				visitType: true,

				// assignment fields must exist in Appointment model
				addressRemark: true,
				assignedToId: true,
				assignedAt: true,

				lab: { select: { name: true, nickName: true, labCode: true } },
				insuranceCompany: { select: { name: true, nickName: true, code: true } },
				tests: {
					select: {
						bloodTest: true,
						urineTest: true,
						ecg: true,
						tmt: true,
						applicationForm: true,
					},
				},
			},
			take: 5000,
		});

		const rows = appts.map((a) => {
			const insuranceName =
				a.insuranceCompany?.nickName ||
				a.insuranceCompany?.name ||
				a.insuranceCompany?.code ||
				'';

			const testSummary = buildTestSummary(a.tests || undefined);

			return {
				id: a.id,

				labId: a.labId || '',
				labNick: a.lab?.nickName || '',
				labName: a.lab?.name || '',
				labCode: a.lab?.labCode || '',

				apptAt: isoOrNull(a.apptAt),

				clientName: a.clientName || '',
				mobileNo: a.phone || '',

				insuranceName,
				testSummary,

				location: a.location || '',
				status: a.status || '',
				visitType: a.visitType || '',

				addressRemark: a.addressRemark || '',
				assignedToId: a.assignedToId || '',
				assignedAt: isoOrNull(a.assignedAt),
			};
		});

		return NextResponse.json(
			{
				mode: isSuperAdmin ? 'ALL_LABS' : 'SINGLE_LAB',
				labId: effectiveLabId,
				users,
				rows,
			},
			{ status: 200 }
		);
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}

/* ----------------------------------------------------------------------- */
/* POST /api/appointments/outer-assignments
   body: { labId?: string, items: [{ id, assignedToId, addressRemark }] }
   ✅ updates ONLY the items sent (filtered rows)
----------------------------------------------------------------------- */
export async function POST(req: Request) {
	try {
		const session = await auth();
		if (!session) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const role = getRole(session);
		const sessionLabId = getLabId(session);
		const isSuperAdmin = role === 'SUPER_ADMIN';

		const body = await req.json().catch(() => ({}));
		const items = Array.isArray(body?.items) ? body.items : [];

		if (!items.length) {
			return NextResponse.json({ error: 'No items to save' }, { status: 400 });
		}

		// validate
		for (const it of items) {
			if (!it?.id) return NextResponse.json({ error: 'Missing appointment id' }, { status: 400 });
			if (!it?.assignedToId) return NextResponse.json({ error: 'Missing assignedToId' }, { status: 400 });
			if (!it?.addressRemark) return NextResponse.json({ error: 'Missing addressRemark' }, { status: 400 });
		}

		// If not super admin, enforce lab scope.
		// If super admin, optional labId in payload can be used (but we still secure by checking appointment row itself).
		const now = new Date();

		const updates = items.map((it: any) => {
			const where: any = { id: String(it.id), isActive: 1 };
			if (!isSuperAdmin) {
				where.labId = sessionLabId;
			} else if (body?.labId) {
				// optional safety narrowing (not mandatory)
				where.labId = String(body.labId);
			}

			return prisma.appointment.updateMany({
				where,
				data: {
					assignedToId: String(it.assignedToId),
					addressRemark: String(it.addressRemark),
					assignedAt: now,
				},
			});
		});

		const results = await prisma.$transaction(updates);
		const updatedCount = results.reduce((sum, r) => sum + (r?.count || 0), 0);

		if (updatedCount === 0) {
			return NextResponse.json(
				{ error: 'No rows updated. Check lab scope or appointment ids.' },
				{ status: 400 }
			);
		}

		return NextResponse.json({ ok: true, updatedCount }, { status: 200 });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
