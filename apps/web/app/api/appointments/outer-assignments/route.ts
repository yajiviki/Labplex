// app/api/appointments/outer-assignments/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

function iso(d?: Date | null) {
	return d ? new Date(d).toISOString() : null;
}

function buildTestSummary(t?: {
	bloodTest: 'No' | 'FB' | 'B';
	urineTest: boolean;
	ecg: boolean;
	tmt: boolean;
	applicationForm: 'MER' | 'FMR' | 'ALL' | null;
} | null) {
	if (!t) return '';
	const parts: string[] = [];
	if (t.bloodTest && t.bloodTest !== 'No') parts.push(t.bloodTest);
	if (t.urineTest) parts.push('U');
	if (t.ecg) parts.push('ECG');
	if (t.tmt) parts.push('TMT');
	if (t.applicationForm) parts.push(t.applicationForm);
	return parts.join(',');
}

/**
 * GET /api/appointments/outer-assignments
 * SUPER_ADMIN:
 *   - can pass ?labId=<labId> to fetch for a specific lab
 *   - if labId is not passed, returns upcoming for ALL labs
 * STAFF/ADMIN/LAB_ADMIN:
 *   - scoped automatically to their session labId
 *
 * Returns:
 *  { staff: [...], rows: [...] }
 * staff list is scoped to the selected lab (or user's lab). For ALL labs mode, staff = []
 * (Because staff belongs to a specific lab. You can load staff per-lab in UI.)
 */
export async function GET(req: Request) {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const role =
			((session as any)?.user?.role as string) ||
			((session as any)?.role as string) ||
			'USER';

		const sessionLabId =
			((session as any)?.labId as string) ||
			((session as any)?.user?.labId as string) ||
			((session as any)?.user?.lab?.id as string) ||
			'';

		const url = new URL(req.url);
		const labIdParam = (url.searchParams.get('labId') || '').trim();

		// Determine effective labId
		// - SUPER_ADMIN: labId optional; empty means ALL labs
		// - Others: must have session lab id
		let effectiveLabId: string | null = null;
		let allLabsMode = false;

		if (role === 'SUPER_ADMIN') {
			if (labIdParam) effectiveLabId = labIdParam;
			else allLabsMode = true;
		} else {
			if (!sessionLabId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
			effectiveLabId = sessionLabId;
		}

		const now = new Date();

		// Where filter
		const where: any = {
			isActive: 1,
			apptAt: { gte: now },
			serviceType: 'Outer',
			status: { in: ['Need Confirmation', 'Confirmed'] },
		};
		if (!allLabsMode) where.labId = effectiveLabId;

		const apptsPromise = prisma.appointment.findMany({
			where,
			orderBy: { apptAt: 'asc' },
			select: {
				id: true,
				apptAt: true,
				clientRef: true,
				phone: true,
				location: true,
				status: true,
				labId: true,

				// assignment fields (must exist on Appointment model)
				addressRemark: true,
				assignedToId: true,
				assignedAt: true,

				insuranceCompany: { select: { name: true, nickName: true } },
				tests: {
					select: {
						bloodTest: true,
						urineTest: true,
						ecg: true,
						tmt: true,
						applicationForm: true,
					},
				},
				lab: { select: { name: true, nickName: true, labCode: true } },
			},
			take: 5000,
		});

		// Staff list:
		// - If ALL labs mode, return empty list (UI should load staff per lab or force lab select)
		// - If single lab mode, load staff for that lab
		const staffPromise = allLabsMode
			? Promise.resolve([])
			: prisma.user.findMany({
				where: {
					isActive: 1,
					labId: effectiveLabId!,
					OR: [{ role: 'STAFF' }, { role: 'LAB_ADMIN' }, { role: 'ADMIN' }],
				},
				orderBy: { name: 'asc' },
				select: { id: true, name: true, userId: true, phone: true, role: true },
			});

		const [staff, appts] = await Promise.all([staffPromise, apptsPromise]);

		const rows = appts.map((a) => ({
			id: a.id,
			labId: a.labId ?? '',
			labNick: a.lab?.nickName ?? '',
			labName: a.lab?.name ?? '',
			labCode: a.lab?.labCode ?? '',

			apptAt: iso(a.apptAt),
			proposalNo: a.clientRef ?? '',
			mobileNo: a.phone ?? '',
			insuranceName: a.insuranceCompany?.nickName || a.insuranceCompany?.name || '',
			testSummary: buildTestSummary(a.tests ?? null),
			location: a.location ?? '',
			status: a.status ?? '',

			addressRemark: a.addressRemark ?? '',
			assignedToId: a.assignedToId ?? '',
			assignedAt: iso(a.assignedAt ?? null),
		}));

		return NextResponse.json(
			{
				mode: allLabsMode ? 'ALL_LABS' : 'SINGLE_LAB',
				labId: effectiveLabId,
				staff,
				rows,
			},
			{ status: 200 }
		);
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}

/**
 * POST /api/appointments/outer-assignments
 * Body:
 *  {
 *    labId?: string,  // required for SUPER_ADMIN when assigning for a specific lab (recommended)
 *    items: [{ id, assignedToId, addressRemark }]
 *  }
 *
 * SUPER_ADMIN:
 *  - can assign across all labs. We validate each row belongs to a lab.
 *  - if you pass labId, we enforce that the rows belong to that lab (safer).
 *
 * STAFF/ADMIN/LAB_ADMIN:
 *  - scoped to their session labId
 */
export async function POST(req: Request) {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const role =
			((session as any)?.user?.role as string) ||
			((session as any)?.role as string) ||
			'USER';

		const sessionLabId =
			((session as any)?.labId as string) ||
			((session as any)?.user?.labId as string) ||
			((session as any)?.user?.lab?.id as string) ||
			'';

		const body = await req.json().catch(() => ({}));
		const items = Array.isArray(body?.items) ? body.items : [];
		const labIdParam = typeof body?.labId === 'string' ? body.labId.trim() : '';

		if (!items.length) return NextResponse.json({ error: 'No items to save' }, { status: 400 });

		// Determine effective lab constraint
		let effectiveLabId: string | null = null;
		let allLabsMode = false;

		if (role === 'SUPER_ADMIN') {
			if (labIdParam) effectiveLabId = labIdParam; // safe mode
			else allLabsMode = true; // allow across labs
		} else {
			if (!sessionLabId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
			effectiveLabId = sessionLabId;
		}

		// Validate input
		for (const it of items) {
			if (!it?.id) return NextResponse.json({ error: 'Missing appointment id' }, { status: 400 });
			if (!it?.assignedToId) return NextResponse.json({ error: 'Please select staff for all rows' }, { status: 400 });
			if (!String(it?.addressRemark || '').trim()) {
				return NextResponse.json({ error: 'Please enter Address Remark for all rows' }, { status: 400 });
			}
		}

		const now = new Date();

		// Optional: extra validation in SUPER_ADMIN all-labs mode that staff belongs to the appointment's lab
		// We’ll enforce this by reading appointments and joining staff.labId.
		// This avoids assigning Lab-A staff to Lab-B appointment.
		if (role === 'SUPER_ADMIN') {
			const apptIds = items.map((x: any) => String(x.id));
			const appts = await prisma.appointment.findMany({
				where: { id: { in: apptIds }, isActive: 1 },
				select: { id: true, labId: true },
			});

			const apptLab = new Map(appts.map(a => [a.id, a.labId || '']));
			const staffIds = items.map((x: any) => String(x.assignedToId));
			const staffs = await prisma.user.findMany({
				where: { id: { in: staffIds }, isActive: 1 },
				select: { id: true, labId: true },
			});
			const staffLab = new Map(staffs.map(s => [s.id, s.labId]));

			for (const it of items) {
				const apptLabId = apptLab.get(String(it.id)) || '';
				if (!apptLabId) {
					return NextResponse.json({ error: `Appointment not found or lab missing: ${it.id}` }, { status: 400 });
				}
				if (effectiveLabId && apptLabId !== effectiveLabId) {
					return NextResponse.json({ error: `Appointment does not belong to selected lab: ${it.id}` }, { status: 400 });
				}
				const stLabId = staffLab.get(String(it.assignedToId));
				if (!stLabId) {
					return NextResponse.json({ error: `Staff not found: ${it.assignedToId}` }, { status: 400 });
				}
				if (stLabId !== apptLabId) {
					return NextResponse.json({ error: `Staff and appointment lab mismatch for appointment ${it.id}` }, { status: 400 });
				}
			}
		}

		await prisma.$transaction(
			items.map((it: any) => {
				const where: any = {
					id: String(it.id),
					isActive: 1,
					serviceType: 'Outer',
					status: { in: ['Need Confirmation', 'Confirmed'] },
					apptAt: { gte: now },
				};

				// Scope update for non-superadmin; or for superadmin safe lab mode
				if (!allLabsMode) where.labId = effectiveLabId;

				return prisma.appointment.updateMany({
					where,
					data: {
						assignedToId: String(it.assignedToId),
						addressRemark: String(it.addressRemark || '').trim(),
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
