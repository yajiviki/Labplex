import { NextResponse } from 'next/server';
import { auth } from '../../../../lib/auth';
import { prisma } from '../../../../lib/db';


export async function PUT(req: Request, { params }: { params: { id: string } }) {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const id = params.id;
		const { name, code } = await req.json().catch(() => ({}));
		if (!name?.trim()) {
			return NextResponse.json({ error: 'name is required.' }, { status: 400 });
		}
		const updated = await prisma.insuranceCompany.update({
			where: { id },
			data: { name: name.trim(), code: code?.trim() || null },
			select: { id: true, name: true, code: true, vendorId: true },
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

		await prisma.insuranceCompany.update({ where: { id: params.id }, data: { isActive: 0 } });
		return NextResponse.json({ ok: true });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
