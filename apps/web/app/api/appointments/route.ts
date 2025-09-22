import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';
import { auth } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

type Source = 'INSURANCE' | 'DOCTOR' | 'DIRECT' | 'OUTER_LAB';
type VisitType = 'CENTER' | 'HOME';
type Status =
	| 'BOOKED' | 'CHECKED_IN' | 'SAMPLING' | 'PROCESSING'
	| 'REPORT_READY' | 'CLOSED' | 'CANCELED';

function canManageAll(role?: string | null) {
	return role === 'SUPER_ADMIN' || role === 'ADMIN';
}
function canManageOwn(role?: string | null) {
	return role === 'LAB_ADMIN' || role === 'STAFF';
}

/* ------------------------------ GET /api/appointments ------------------------------ */
/** Query params:
 *  - q: string (patientId, patientName, phone, doctorName, notes)
 *  - status: Status
 *  - source: Source
 *  - dateFrom: ISO string
 *  - dateTo: ISO string
 *  - labCode: (ADMIN/SUPER_ADMIN only) filter by lab code
 */
export async function GET(req: Request) {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const role = (session as any)?.user?.role as string | undefined;
		const sessionLabId = (session as any)?.user?.labId as string | undefined;

		const { searchParams } = new URL(req.url);
		const q = searchParams.get('q')?.trim() || '';
		const status = searchParams.get('status') || '';
		const source = searchParams.get('source') || '';
		const dateFrom = searchParams.get('dateFrom'); // ISO
		const dateTo = searchParams.get('dateTo');     // ISO
		const labCode = searchParams.get('labCode') || '';

		// Build where
		const where: any = { isActive: 1 };

		// Admin can filter any lab via labCode; others are pinned to their own lab
		if (canManageAll(role) && labCode) {
			const lab = await prisma.lab.findUnique({
				where: { labCode },
				select: { id: true },
			});
			// If labCode provided but missing, return empty set (not error)
			if (lab) where.labId = lab.id; else where.labId = '__no_lab__';
		} else {
			// non-admin users see their own lab only
			where.labId = sessionLabId;
		}

		if (q) {
			where.OR = [
				{ patientId: { contains: q, mode: 'insensitive' } },
				{ patientName: { contains: q, mode: 'insensitive' } },
				{ phone: { contains: q, mode: 'insensitive' } },
				{ doctorName: { contains: q, mode: 'insensitive' } },
				{ notes: { contains: q, mode: 'insensitive' } },
				{ testCode: { contains: q, mode: 'insensitive' } },
				{ testDescription: { contains: q, mode: 'insensitive' } },
				{ tpaName: { contains: q, mode: 'insensitive' } },
				{ insuranceName: { contains: q, mode: 'insensitive' } },
				{ address: { contains: q, mode: 'insensitive' } },
			];
		}
		if (status) where.status = status as Status;
		if (source) where.source = source as Source;
		if (dateFrom || dateTo) {
			where.apptAt = {};
			if (dateFrom) where.apptAt.gte = new Date(dateFrom);
			if (dateTo) where.apptAt.lte = new Date(dateTo);
		}

		const items = await prisma.appointment.findMany({
			where,
			orderBy: { apptAt: 'desc' },
			select: {
				id: true, labId: true,
				patientId: true, patientName: true, phone: true,
				source: true, visitType: true, doctorName: true, insuranceVendorId: true,
				apptAt: true, status: true, tatHours: true, notes: true,
				// optional/extended fields if present in your schema
				gender: true, age: true, address: true,
				tpaName: true, insuranceName: true,
				testCode: true, testDescription: true,
				createdAt: true, updatedAt: true,
				lab: { select: { labCode: true, name: true } },
			},
		});
		return NextResponse.json(items);
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}

/* ------------------------------ POST /api/appointments ------------------------------ */
/** Body (min): { source, visitType, apptAt }
 *  Admins: may pass { labCode } to target a lab. Others are pinned to their own lab.
 *  Optional: patientId, patientName, phone, doctorName, insuranceVendorId, status, tatHours, notes,
 *            gender, age, address, tpaName, insuranceName, testCode, testDescription
 */
export async function POST(req: Request) {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const role = (session as any)?.user?.role as string | undefined;
		const sessionLabId = (session as any)?.user?.labId as string | undefined;

		if (!canManageAll(role) && !canManageOwn(role)) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

		const body = await req.json().catch(() => ({}));
		const {
			// required
			source, visitType, apptAt,
			// optional basics
			status, tatHours, notes,
			patientId, patientName, phone,
			doctorName, insuranceVendorId,
			// extended
			gender, age, address, tpaName, insuranceName, testCode, testDescription,
			// admin-only targeting
			labCode,
		} = body;

		if (!source || !visitType || !apptAt) {
			return NextResponse.json({ error: 'source, visitType, apptAt are required.' }, { status: 400 });
		}

		// Resolve labId
		let labId: string | undefined = sessionLabId;
		if (canManageAll(role)) {
			if (!labCode?.trim()) {
				return NextResponse.json({ error: 'Lab Code is required for admin creation.' }, { status: 400 });
			}
			const lab = await prisma.lab.findUnique({ where: { labCode: labCode.trim() }, select: { id: true } });
			if (!lab) return NextResponse.json({ error: 'Invalid Lab Code.' }, { status: 400 });
			labId = lab.id;
		}

		// Normalize phone if provided
		let phoneDigits: string | null = null;
		if (phone != null) {
			const d = String(phone).replace(/\D+/g, '');
			if (d && (d.length < 10 || d.length > 15)) {
				return NextResponse.json({ error: 'Please enter a valid Mobile number (10–15 digits).' }, { status: 400 });
			}
			phoneDigits = d || null;
		}

		const created = await prisma.appointment.create({
			data: {
				labId: labId as string,
				patientId: patientId || null,
				patientName: patientName || null,
				phone: phoneDigits,
				source,
				visitType,
				doctorName: doctorName || null,
				insuranceVendorId: insuranceVendorId || null,
				apptAt: new Date(apptAt),
				status: (status as Status) || 'BOOKED',
				tatHours: tatHours ?? null,
				notes: notes || null,
				// extended
				gender: gender ?? null,
				age: typeof age === 'number' ? age : null,
				address: address ?? null,
				tpaName: tpaName ?? null,
				insuranceName: insuranceName ?? null,
				testCode: testCode ?? null,
				testDescription: testDescription ?? null,
				isActive: 1,
			},
			select: {
				id: true,
				lab: { select: { labCode: true, name: true } },
				patientId: true, patientName: true, phone: true,
				source: true, visitType: true, doctorName: true, insuranceVendorId: true,
				apptAt: true, status: true, tatHours: true, notes: true,
				gender: true, age: true, address: true, tpaName: true, insuranceName: true,
				testCode: true, testDescription: true,
				createdAt: true,
			},
		});

		return NextResponse.json(created, { status: 201 });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
