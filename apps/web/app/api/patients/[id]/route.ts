import { NextResponse } from 'next/server';
import { auth } from '../../../../lib/auth';
import { prisma } from '../../../../lib/db';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const id = params.id;
		const body = await req.json().catch(() => ({}));
		const { name, address, phone, doctorName } = body; // vendorId accepted but ignored

		const normalizedPhone = (phone || '').toString().replace(/\D+/g, '');
		if (!name?.trim() || !normalizedPhone) {
			return NextResponse.json({ error: 'Please fill Name and Mobile.' }, { status: 400 });
		}

		const updated = await prisma.patient.update({
			where: { id },
			data: {
				name: name.trim(),
				address: address || null,
				phone: normalizedPhone,
				doctorName: doctorName || null,
				// vendorId removed (no longer in schema)
				//insuranceCompanyId: insuranceCompanyId || null,
			},
			select: {
				id: true,
				patientId: true,
				name: true,
				address: true,
				phone: true,
				doctorName: true,
				// vendorId removed from select
				//insuranceCompanyId: true,
				// vendor relation removed
				//insuranceCompany: { select: { id: true, name: true } },
				createdAt: true,
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
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		await prisma.patient.update({ where: { id: params.id }, data: { isActive: 0 } });
		return NextResponse.json({ ok: true });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
