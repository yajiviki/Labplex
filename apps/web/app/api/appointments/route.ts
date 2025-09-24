import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';
import { auth } from '../../../lib/auth';

/**
 * GET /api/appointments
 * Query params: q, status, vendorId, labId, insuranceCompanyId, dateFrom, dateTo
 * If session has labId → scope results to that lab; super admin (no labId) sees all labs.
 */
export async function GET(req: Request) {
	try {
		const session = await auth();
		const sessionLabId = (session as any)?.labId as string | undefined;

		const { searchParams } = new URL(req.url);
		const q = searchParams.get('q')?.trim() || '';
		const status = searchParams.get('status')?.trim() || '';
		const vendorId = searchParams.get('vendorId')?.trim() || '';
		const labId = searchParams.get('labId')?.trim() || '';
		const insuranceCompanyId = searchParams.get('insuranceCompanyId')?.trim() || '';
		const dateFrom = searchParams.get('dateFrom');
		const dateTo = searchParams.get('dateTo');

		const where: any = { isActive: 1 };
		if (sessionLabId) where.labId = sessionLabId;

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
		if (labId) where.labId = labId;
		if (insuranceCompanyId) where.insuranceCompanyId = insuranceCompanyId;

		if (dateFrom || dateTo) {
			where.apptAt = {};
			if (dateFrom) where.apptAt.gte = new Date(dateFrom);
			if (dateTo) where.apptAt.lte = new Date(dateTo);
		}

		const items = await prisma.appointment.findMany({
			where,
			orderBy: { apptAt: 'desc' },
		});
		return NextResponse.json(items);
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}

/**
 * POST /api/appointments
 * Accepts both legacy and new field names; writes to single `status` column.
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
			address,
			phone,

			visitType,
			location,
			status,
			extraChargeRs,
			paymentStatus,
		} = body;

		if (!apptAt) return NextResponse.json({ error: 'apptAt is required' }, { status: 400 });
		const resolvedVendorId = vendorId || insuranceVendorId || null;
		if (!resolvedVendorId) return NextResponse.json({ error: 'vendorId is required' }, { status: 400 });
		if (!insuranceCompanyId) return NextResponse.json({ error: 'insuranceCompanyId is required' }, { status: 400 });
		if (!visitType) return NextResponse.json({ error: 'visitType is required' }, { status: 400 });
		if (!status) return NextResponse.json({ error: 'status is required' }, { status: 400 });

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
				address: address || null,
				phone: phone || null,

				visitType,
				location: location || null,
				status,
				extraChargeRs: typeof extraChargeRs === 'number' ? extraChargeRs : (extraChargeRs ? Number(extraChargeRs) : null),
				paymentStatus: paymentStatus || 'On Account',

				isActive: 1,
			},
		});

		return NextResponse.json(created, { status: 201 });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
