import { NextResponse } from 'next/server';
import { auth } from '../../../../lib/auth';
import { prisma } from '../../../../lib/db';


export async function PUT(req: Request, { params }: { params: { id: string } }) {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const id = params.id;
		const { name, tpaName, insuranceName, doctorName, address, phone } = await req.json().catch(() => ({}));
		if (!name?.trim() || !phone?.trim()) return NextResponse.json({ error: 'Please fill Name and Mobile.' }, { status: 400 });

		const updated = await prisma.patient.update({
			where: { id },
			data: {
				name: name.trim(),
				tpaName: tpaName || null,
				insuranceName: insuranceName || null,
				doctorName: doctorName || null,
				address: address || null,
				phone: phone.trim(),
			},
			select: {
				id: true, patientId: true, name: true, tpaName: true, insuranceName: true,
				doctorName: true, address: true, phone: true, createdAt: true,
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
