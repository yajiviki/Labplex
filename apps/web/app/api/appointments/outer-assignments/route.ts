// app/api/appointments/outer-assignments/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

/* ---------------- Helpers ---------------- */

function iso(d: Date | null | undefined) {
	return d ? new Date(d).toISOString() : null;
}

function ynBool(v: unknown) {
	if (v === true) return true;
	if (typeof v === 'string') return v.trim().toLowerCase() === 'yes' || v.trim().toLowerCase() === 'true' || v.trim() === '1';
	if (typeof v === 'number') return v !== 0;
	return false;
}

function buildTestSummary(t?: {
	bloodTest: string | null;
	urineTest: boolean | null;
	ecg: boolean | null;
	tmt: boolean | null;
	applicationForm: string | null;
} | null) {
	if (!t) return '';
	const parts: string[] = [];

	// Blood
	if (t.bloodTest && t.bloodTest !== 'No') parts.push(t.bloodTest);

	// Others
	if (t.urineTest) parts.push('U');
	if (t.ecg) parts.push('ECG');
	if (t.tmt) parts.push('TMT');
	if (t.applicationForm) parts.push(t.applicationForm);

	return parts.join(',');
}

/* ---------------- GET ----------------
 * GET /api/appointments/outer-assignments?labId=
 * - SUPER_ADMIN: can pass labId or leave empty to see all labs
 * - Others: always scoped to their session labId
 */
export async function GET(req: Request) {
	try {
		const session = await auth();
		const role =
			((session as any)?.user?.role as string | undefined) ||
			((session as any)?.role as string | undefined) ||
			'USER';

		if (!session) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const isSuperAdmin = role === 'SUPER_ADMIN';

		const sessionLabId = (session as any)?.labId as string | undefined;

		const { searchParams } = new URL(req.url);
		const labIdParam = (searchParams.get('labId') || '').trim();

		// Lab scope:
		// - SUPER_ADMIN: optional filter
		// - others: forced to sessionLabId
		const effectiveLabId = isSuperAdmin ? (labIdParam || null) : (sessionLabId || null);

		if (!isSuperAdmin && !effectiveLabId) {
			return NextResponse.json({ error: 'Lab scope missing' }, { status: 400 });
		}

		// Only upcoming + outer + statuses
		const now = new Date();
		const where: any = {
			isActive: 1,
			serviceType: { equals: 'Outer', mode: 'insensitive' },
			status: { in: ['Need Confirmation', 'Confirmed'] },
			apptAt: { gte: now },
		};

		if (effectiveLabId) where.labId = effectiveLabId;

		const appts = await prisma.appointment.findMany({
			where,
			orderBy: { apptAt: 'asc' },
			select: {
				id: true,
				labId: true,
				apptAt: true,

				clientName: true,
				clientRef: true,
				phone: true,
				location: true,
				status: true,

				// assignment fields (must exist in Appointment model)
				addressRemark: true,
				assignedToId: true,
				assignedAt: true,

				insuranceCompany: { select: { name: true, nickName: true } },
				lab: { select: { name: true, nickName: true, labCode: true } },

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

		// ✅ IMPORTANT: return ALL active users for dropdown (any role, any lab)
		const users = await prisma.user.findMany({
			where: { isActive: 1, role: { equals: 'USER', mode: 'insensitive' }, },
			orderBy: [{ name: 'asc' }],
			select: {
				id: true,
				name: true,
				userId: true,
				phone: true,
				role: true,
				labId: true,
				lab: { select: { nickName: true, name: true, labCode: true } },
			},
			take: 20000,
		});

		const rows = appts.map(a => ({
			id: a.id,
			labId: a.labId || '',

			labNick: a.lab?.nickName || '',
			labName: a.lab?.name || '',
			labCode: a.lab?.labCode || '',

			apptAt: iso(a.apptAt),
			clientName: a.clientName || '',
			mobileNo: a.phone || '',
			insuranceName: a.insuranceCompany?.nickName || a.insuranceCompany?.name || '',
			testSummary: buildTestSummary(a.tests),

			location: a.location || '',
			status: a.status || '',

			addressRemark: a.addressRemark || '',
			assignedToId: a.assignedToId || '',
			assignedAt: iso(a.assignedAt),
		}));

		return NextResponse.json(
			{
				mode: isSuperAdmin ? (effectiveLabId ? 'SINGLE_LAB' : 'ALL_LABS') : 'SINGLE_LAB',
				labId: effectiveLabId,
				users, // <-- dropdown list
				rows,
			},
			{ status: 200 }
		);
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}

/* ---------------- POST ----------------
 * POST /api/appointments/outer-assignments
 * body:
 * {
 *   labId?: string | null,
 *   items: [{ id, assignedToId, addressRemark }]
 * }
 */
export async function POST(req: Request) {
	try {
		const session = await auth();
		const role =
			((session as any)?.user?.role as string | undefined) ||
			((session as any)?.role as string | undefined) ||
			'USER';

		if (!session) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const isSuperAdmin = role === 'SUPER_ADMIN';
		const sessionLabId = (session as any)?.labId as string | undefined;

		const body = await req.json().catch(() => ({}));
		const items = Array.isArray(body?.items) ? body.items : [];
		const labId = (body?.labId || '').trim() || null;

		if (!items.length) {
			return NextResponse.json({ error: 'No items to save' }, { status: 400 });
		}

		// Scope:
		// - SUPER_ADMIN can save across labs (no restriction)
		// - Others are restricted to their lab
		if (!isSuperAdmin && !sessionLabId) {
			return NextResponse.json({ error: 'Lab scope missing' }, { status: 400 });
		}

		// Basic validation
		for (const it of items) {
			if (!it?.id) return NextResponse.json({ error: 'Missing appointment id' }, { status: 400 });
			if (!it?.assignedToId) return NextResponse.json({ error: 'assignedToId is required for all rows' }, { status: 400 });
			if (!it?.addressRemark || !String(it.addressRemark).trim()) {
				return NextResponse.json({ error: 'addressRemark is required for all rows' }, { status: 400 });
			}
		}

		const now = new Date();

		// Save per-row (different staff/remark per appt) in a transaction
		await prisma.$transaction(
			items.map((it: any) => {
				const where: any = { id: String(it.id), isActive: 1 };

				// if non-super admin, lock to session lab
				if (!isSuperAdmin) where.labId = sessionLabId;

				// if super admin and labId was provided, optional additional safety
				if (isSuperAdmin && labId) where.labId = labId;

				return prisma.appointment.update({
					where,
					data: {
						assignedToId: String(it.assignedToId),
						addressRemark: String(it.addressRemark).trim(),
						assignedAt: now,
					},
				});
			})
		);

		return NextResponse.json({ ok: true }, { status: 200 });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
