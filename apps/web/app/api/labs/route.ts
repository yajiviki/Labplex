import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';
import { auth } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

function canManageAll(role?: string | null) {
	return role === 'SUPER_ADMIN' || role === 'ADMIN';
}

export async function GET(req: Request) {
	const session = await auth();
	if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const role = (session as any)?.user?.role as string | undefined;
	const userLabId = (session as any)?.user?.labId as string | undefined;
	const { searchParams } = new URL(req.url);
	const select = searchParams.get('select');

	// Lightweight dropdown list
	if (select === 'codeAndName') {
		const where = canManageAll(role) ? { isActive: 1 } : { id: userLabId, isActive: 1 };
		const labs = await prisma.lab.findMany({
			where,
			orderBy: { labCode: 'asc' },
			select: { labCode: true, name: true },
		});
		return NextResponse.json(labs);
	}

	// Full list: all if admin/super-admin, else only own lab
	const where = canManageAll(role) ? {} : { id: userLabId };
	const labs = await prisma.lab.findMany({
		where,
		orderBy: { createdAt: 'desc' },
		select: {
			id: true,
			labCode: true,
			name: true,
			address: true,
			phone: true,
			email: true,
			isActive: true,
			createdAt: true,
			updatedAt: true,
		},
	});
	return NextResponse.json(labs);
}

export async function POST(req: Request) {
	const session = await auth();
	if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

	const role = (session as any)?.user?.role as string | undefined;
	if (!canManageAll(role)) {
		return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
	}

	const body = await req.json().catch(() => ({}));
	const { labCode, name, address, phone, email } = body || {};
	if (!labCode?.trim() || !name?.trim()) {
		return NextResponse.json({ error: 'Lab Code and Name are required.' }, { status: 400 });
	}

	try {
		const created = await prisma.lab.create({
			data: {
				labCode: labCode.trim(),
				name: name.trim(),
				address: (address || '').trim() || null,
				phone: (phone || '').trim() || null,
				email: (email || '').trim() || null,
				isActive: 1,
			},
			select: {
				id: true,
				labCode: true,
				name: true,
				address: true,
				phone: true,
				email: true,
				createdAt: true,
			},
		});
		return NextResponse.json(created, { status: 201 });
	} catch (e: any) {
		if (e?.code === 'P2002') {
			return NextResponse.json({ error: 'Lab Code already exists.' }, { status: 409 });
		}
		return NextResponse.json({ error: e?.message || 'Create failed' }, { status: 500 });
	}
}
