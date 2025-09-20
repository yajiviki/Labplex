import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';
import { auth } from '../../../lib/auth';

type Source = 'INSURANCE' | 'DOCTOR' | 'DIRECT' | 'OUTER_LAB';
type VisitType = 'CENTER' | 'HOME';
type Status =
	| 'BOOKED' | 'CHECKED_IN' | 'SAMPLING' | 'PROCESSING'
	| 'REPORT_READY' | 'CLOSED' | 'CANCELED';

export async function GET(req: Request) {
	try {
		const session = await auth();
		const labId = (session as any)?.labId as string | undefined;
		if (!labId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const { searchParams } = new URL(req.url);
		const q = searchParams.get('q')?.trim() || '';
		const status = searchParams.get('status') || '';
		const source = searchParams.get('source') || '';
		const dateFrom = searchParams.get('dateFrom'); // ISO
		const dateTo = searchParams.get('dateTo');     // ISO

		const where: any = { labId, isActive: 1 };
		if (q) {
			where.OR = [
				{ patientId: { contains: q, mode: 'insensitive' } },
				{ patientName: { contains: q, mode: 'insensitive' } },
				{ phone: { contains: q, mode: 'insensitive' } },
				{ doctorName: { contains: q, mode: 'insensitive' } },
				{ notes: { contains: q, mode: 'insensitive' } },
			];
		}
		if (status) where.status = status;
		if (source) where.source = source;
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

export async function POST(req: Request) {
	try {
		const session = await auth();
		const labId = (session as any)?.labId as string | undefined;
		if (!labId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const body = await req.json().catch(() => ({}));
		const {
			patientId, patientName, phone,
			source, visitType, doctorName, insuranceVendorId,
			apptAt, status, tatHours, notes,
		} = body;

		if (!source || !visitType || !apptAt) {
			return NextResponse.json({ error: 'source, visitType, apptAt are required.' }, { status: 400 });
		}

		const created = await prisma.appointment.create({
			data: {
				labId,
				patientId: patientId || null,
				patientName: patientName || null,
				phone: phone || null,
				source,
				visitType,
				doctorName: doctorName || null,
				insuranceVendorId: insuranceVendorId || null,
				apptAt: new Date(apptAt),
				status: status || 'BOOKED',
				tatHours: tatHours ?? null,
				notes: notes || null,
				isActive: 1,
			},
		});

		return NextResponse.json(created, { status: 201 });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
