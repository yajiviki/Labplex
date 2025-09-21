import { NextResponse } from 'next/server';
import { auth } from '../../../../lib/auth';
import { prisma } from '../../../../lib/db';


export async function PUT(req: Request, { params }: { params: { id: string } }) {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const id = params.id;
		const { tpaName, insuranceName, address, phone } = await req.json().catch(() => ({}));
		const normalizedPhone = (phone || '').toString().replace(/\D+/g, '');
		if (!tpaName?.trim() || !normalizedPhone) {
			return NextResponse.json({ error: 'Please fill TPA Name and Mobile.' }, { status: 400 });
		}

		const updated = await prisma.vendor.update({
			where: { id },
			data: {
				tpaName: tpaName.trim(),
				insuranceName: (insuranceName || null),
				address: (address || null),
				phone: normalizedPhone,
			},
			select: {
				id: true, vendorId: true, tpaName: true, insuranceName: true,
				address: true, phone: true, createdAt: true,
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

		await prisma.vendor.update({ where: { id: params.id }, data: { isActive: 0 } });
		return NextResponse.json({ ok: true });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
