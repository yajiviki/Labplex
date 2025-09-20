import { NextResponse } from 'next/server';
import { auth } from '../../../../lib/auth';
import { prisma } from '../../../../lib/db';


export async function PUT(req: Request, { params }: { params: { id: string } }) {
	try {
		const session = await auth();
		const role = (session as any)?.role as string | undefined;
		if (!(role === 'ADMIN' || role === 'SUPER_ADMIN'))
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

		const id = params.id;
		const { name, address, phone, email } = await req.json().catch(() => ({}));
		if (!name?.trim() || !phone?.trim())
			return NextResponse.json({ error: 'Please fill Name and Mobile.' }, { status: 400 });

		const updated = await prisma.lab.update({
			where: { id },
			data: {
				name: name.trim(),
				address: address?.trim() || null,
				phone: phone.trim(),
				email: email?.trim() || null,
			},
			select: { id: true, labCode: true, name: true, address: true, phone: true, email: true, createdAt: true },
		});

		return NextResponse.json(updated);
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
	try {
		const session = await auth();
		const role = (session as any)?.role as string | undefined;
		if (!(role === 'ADMIN' || role === 'SUPER_ADMIN'))
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

		await prisma.lab.update({ where: { id: params.id }, data: { isActive: 0 } });
		return NextResponse.json({ ok: true });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
