import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

function canManageAll(role?: string | null) {
	return role === 'SUPER_ADMIN' || role === 'ADMIN';
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
	const session = await auth();
	if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const role = (session as any)?.user?.role as string | undefined;
	if (!canManageAll(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

	const body = await req.json().catch(() => ({}));
	const { labCode, name, address, phone, email, isActive } = body || {};

	try {
		const updated = await prisma.lab.update({
			where: { id: params.id },
			data: {
				labCode: labCode?.trim(),
				name: name?.trim(),
				address: (address || '').trim() || null,
				phone: (phone || '').trim() || null,
				email: (email || '').trim() || null,
				isActive: typeof isActive === 'number' ? isActive : undefined,
			},
			select: {
				id: true,
				labCode: true,
				name: true,
				address: true,
				phone: true,
				email: true,
				isActive: true,
				updatedAt: true,
			},
		});
		return NextResponse.json(updated);
	} catch (e: any) {
		if (e?.code === 'P2002') {
			return NextResponse.json({ error: 'Lab Code already exists.' }, { status: 409 });
		}
		return NextResponse.json({ error: e?.message || 'Update failed' }, { status: 500 });
	}
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
	const session = await auth();
	if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const role = (session as any)?.user?.role as string | undefined;
	if (!canManageAll(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

	try {
		await prisma.lab.update({
			where: { id: params.id },
			data: { isActive: 0 },
		});
		return NextResponse.json({ ok: true });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Delete failed' }, { status: 500 });
	}
}
