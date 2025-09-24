import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
	try {
		const session = await auth();
		const sessionLabId = (session as any)?.labId as string | undefined;

		const id = params.id;
		if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

		const body = await req.json().catch(() => ({}));

		// Scope by lab if session has labId
		const existing = await prisma.appointment.findFirst({
			where: { id, ...(sessionLabId ? { labId: sessionLabId } : {}), isActive: 1 },
		});
		if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

		const resolvedVendorId = body.vendorId || body.insuranceVendorId || existing.vendorId;

		const updated = await prisma.appointment.update({
			where: { id },
			data: {
				apptAt: body.apptAt ? new Date(body.apptAt) : existing.apptAt,

				vendorId: resolvedVendorId ?? existing.vendorId,
				insuranceCompanyId: body.insuranceCompanyId ?? existing.insuranceCompanyId,
				labId: (body.labId ?? (sessionLabId || existing.labId)),

				clientName: (body.clientName ?? body.patientName ?? existing.clientName),
				clientRef: body.clientRef ?? existing.clientRef,
				gender: body.gender ?? existing.gender,
				age: (body.age !== undefined ? (body.age === null ? null : Number(body.age)) : existing.age),
				address: body.address ?? existing.address,
				phone: body.phone ?? existing.phone,

				visitType: body.visitType ?? existing.visitType,
				location: body.location ?? existing.location,
				status: body.status ?? existing.status,
				extraChargeRs:
					body.extraChargeRs !== undefined
						? (body.extraChargeRs === null ? null : Number(body.extraChargeRs))
						: existing.extraChargeRs,
				paymentStatus: body.paymentStatus ?? existing.paymentStatus,
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
		const sessionLabId = (session as any)?.labId as string | undefined;

		const existing = await prisma.appointment.findFirst({
			where: { id: params.id, ...(sessionLabId ? { labId: sessionLabId } : {}), isActive: 1 },
			select: { id: true },
		});
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
