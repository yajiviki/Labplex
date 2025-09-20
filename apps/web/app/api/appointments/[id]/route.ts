import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
	try {
		const session = await auth();
		const labId = (session as any)?.labId as string | undefined;
		if (!labId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const id = params.id;
		const body = await req.json().catch(() => ({}));

		const existing = await prisma.appointment.findFirst({ where: { id, labId, isActive: 1 } });
		if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

		const updated = await prisma.appointment.update({
			where: { id },
			data: {
				patientId: body.patientId ?? existing.patientId,
				patientName: body.patientName ?? existing.patientName,
				phone: body.phone ?? existing.phone,
				source: body.source ?? existing.source,
				visitType: body.visitType ?? existing.visitType,
				doctorName: body.doctorName ?? existing.doctorName,
				insuranceVendorId: body.insuranceVendorId ?? existing.insuranceVendorId,
				apptAt: body.apptAt ? new Date(body.apptAt) : existing.apptAt,
				status: body.status ?? existing.status,
				tatHours: body.tatHours ?? existing.tatHours,
				notes: body.notes ?? existing.notes,
			},
		});

		return NextResponse.json(updated);
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
	try {
		const session = await auth();
		const labId = (session as any)?.labId as string | undefined;
		if (!labId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const existing = await prisma.appointment.findFirst({ where: { id: params.id, labId, isActive: 1 } });
		if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

		await prisma.appointment.update({
			where: { id: params.id },
			data: { isActive: 0 },
		});

		return NextResponse.json({ ok: true });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
