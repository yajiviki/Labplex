import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';
import { auth } from '../../../lib/auth';

/** Helpers */
function parseDateOnlyStart(v?: string | null) {
	if (!v) return null;
	// Accepts yyyy-mm-dd or yyyy/mm/dd or dd-mm-yyyy
	const a = v.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
	if (a) return new Date(+a[1], +a[2] - 1, +a[3], 0, 0, 0, 0);
	const b = v.match(/^(\d{2})-(\d{2})-(\d{4})$/);
	if (b) return new Date(+b[3], +b[2] - 1, +b[1], 0, 0, 0, 0);
	// fallback: try native
	const d = new Date(v);
	return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date) {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function parseISOOrNull(v?: string | null) {
	if (!v) return null;
	const d = new Date(v);
	return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * GET /api/appointments
 * Query params: q, status, vendorId, labId, insuranceCompanyId, dateFrom(yyyy-mm-dd), dateTo(yyyy-mm-dd)
 * If session has labId → scope results to that lab; super admin (no labId) sees all labs (or filters by labId if provided).
 */
export async function GET(req: Request) {
	try {
		const session = await auth();
		const sessionLabId = (session as any)?.labId as string | undefined;

		const { searchParams } = new URL(req.url);
		const q = searchParams.get('q')?.trim() || '';
		const status = searchParams.get('status')?.trim() || '';
		const vendorId = searchParams.get('vendorId')?.trim() || '';
		const labIdParam = searchParams.get('labId')?.trim() || '';
		const insuranceCompanyId = searchParams.get('insuranceCompanyId')?.trim() || '';
		const dateFrom = searchParams.get('dateFrom');
		const dateTo = searchParams.get('dateTo');

		// Base where: only active
		const where: any = { isActive: 1 };

		// Lab scoping:
		// - If session has labId -> force it
		// - Else, if query labId is present and not “All Labs”, use it
		if (sessionLabId) {
			where.labId = sessionLabId;
		} else if (labIdParam && labIdParam !== 'All Labs') {
			where.labId = labIdParam;
		}

		if (q) {
			where.OR = [
				{ clientName: { contains: q, mode: 'insensitive' } },
				{ clientRef: { contains: q, mode: 'insensitive' } },
				{ phone: { contains: q, mode: 'insensitive' } },
				{ location: { contains: q, mode: 'insensitive' } },
			];
		}
		if (status) where.status = status;
		if (vendorId) where.vendorId = vendorId;
		if (insuranceCompanyId) where.insuranceCompanyId = insuranceCompanyId;

		// Date-only range (inclusive end-of-day)
		if (dateFrom || dateTo) {
			const gte = dateFrom ? parseDateOnlyStart(dateFrom) : null;
			const lte = dateTo ? endOfDay(parseDateOnlyStart(dateTo)!) : null;
			if (gte || lte) {
				where.apptAt = {};
				if (gte) where.apptAt.gte = gte;
				if (lte) where.apptAt.lte = lte;
			}
		}

		const items = await prisma.appointment.findMany({
			where,
			orderBy: { apptAt: 'desc' },
			// include whatever relations you need; kept minimal:
			// include: { lab: true, vendor: true, insuranceCompany: true },
		});

		return NextResponse.json(items);
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}

/**
 * POST /api/appointments
 * Accepts both legacy and new field names; writes to single `status` column.
 * NEW: serviceType, paymentDate (date or ISO)
 * REMOVED: address
 */
export async function POST(req: Request) {
	try {
		const session = await auth();
		const sessionLabId = (session as any)?.labId as string | undefined;

		const body = await req.json().catch(() => ({}));

		const {
			apptAt,
			vendorId,
			insuranceVendorId,       // legacy
			insuranceCompanyId,
			labId,

			clientName,
			patientName,             // legacy
			clientRef,
			gender,
			age,
			// address,               // removed
			phone,

			visitType,
			location,
			status,
			extraChargeRs,
			paymentStatus,

			// NEW
			serviceType,
			paymentDate,             // yyyy-mm-dd or ISO
		} = body;

		if (!apptAt) return NextResponse.json({ error: 'apptAt is required' }, { status: 400 });
		const resolvedVendorId = vendorId || insuranceVendorId || null;
		if (!resolvedVendorId) return NextResponse.json({ error: 'vendorId is required' }, { status: 400 });
		if (!insuranceCompanyId) return NextResponse.json({ error: 'insuranceCompanyId is required' }, { status: 400 });
		if (!visitType) return NextResponse.json({ error: 'visitType is required' }, { status: 400 });
		if (!status) return NextResponse.json({ error: 'status is required' }, { status: 400 });

		// paymentDate can be date-only -> set to local midnight
		let paymentDateDt: Date | null = null;
		if (paymentDate) {
			const d0 = parseDateOnlyStart(paymentDate);
			paymentDateDt = d0 ?? parseISOOrNull(paymentDate);
		}

		const created = await prisma.appointment.create({
			data: {
				apptAt: new Date(apptAt),
				vendorId: resolvedVendorId,
				insuranceCompanyId,
				labId: labId ?? sessionLabId ?? null,

				clientName: (clientName ?? patientName) || null,
				clientRef: clientRef || null,
				gender: gender || null,
				age: typeof age === 'number' ? age : (age ? Number(age) : null),
				// address: removed
				phone: phone || null,

				visitType,
				location: location || null,
				status,
				extraChargeRs: typeof extraChargeRs === 'number' ? extraChargeRs : (extraChargeRs ? Number(extraChargeRs) : null),
				paymentStatus: paymentStatus || 'On Account',

				// NEW
				serviceType: serviceType || null,
				paymentDate: paymentDateDt,

				isActive: 1,
			},
		});

		return NextResponse.json(created, { status: 201 });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
