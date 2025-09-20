import { NextResponse } from 'next/server';
import { auth } from '../../../../lib/auth';
import { prisma } from '../../../../lib/db';


export async function PUT(req: Request, { params }: { params: { id: string } }) {
	try {
		const session = await auth();
		const labId = (session as any)?.labId as string | undefined;
		if (!labId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		let body: any = {};
		try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

		const id = params.id;
		const { name, phone, role, dob, address, email } = body;

		if (!name || !phone || !role) {
			return NextResponse.json({ error: 'Name, Mobile and Role are required.' }, { status: 400 });
		}

		const existing = await prisma.user.findFirst({ where: { id, labId, isActive: 1 } });
		if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

		const updated = await prisma.user.update({
			where: { id },
			data: {
				name,
				phone,
				role,
				dob: dob ? new Date(dob) : null,
				address: address || null,
				email: email ?? existing.email,
			},
			select: {
				id: true, name: true, phone: true, userType: true, role: true,
				dob: true, address: true, email: true, employeeId: true, createdAt: true,
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

		const existing = await prisma.user.findFirst({ where: { id: params.id, labId, isActive: 1 } });
		if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

		await prisma.user.update({
			where: { id: params.id },
			data: { isActive: 0 },                 // 👈 soft delete
		});

		return NextResponse.json({ ok: true });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
