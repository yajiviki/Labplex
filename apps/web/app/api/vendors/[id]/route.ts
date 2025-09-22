import { NextResponse } from 'next/server';
import { auth } from '../../../../lib/auth';
import { prisma } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

function canManageAll(role?: string | null) {
	return role === 'SUPER_ADMIN' || role === 'ADMIN';
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const role = (session as any)?.user?.role as string | undefined;
		if (!canManageAll(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

		const id = params.id;
		if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

		const body = await req.json().catch(() => ({}));
		const { tpaName, insuranceName, address } = body || {};
		let { phone } = body || {};

		// Normalize phone if provided
		let phoneDigits: string | undefined = undefined;
		if (phone != null) {
			phoneDigits = String(phone).replace(/\D+/g, '');
			if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 15)) {
				return NextResponse.json(
					{ error: 'Please enter a valid Mobile number (10–15 digits).' },
					{ status: 400 }
				);
			}
		}

		const updated = await prisma.vendor.update({
			where: { id },
			data: {
				tpaName: tpaName ?? undefined,
				insuranceName: insuranceName ?? undefined,
				address: address ?? undefined,
				phone: phoneDigits ?? undefined,
			},
			select: {
				id: true,
				vendorId: true,
				tpaName: true,
				insuranceName: true,
				address: true,
				phone: true,
				createdAt: true,
			},
		});
		return NextResponse.json(updated);
	} catch (e: any) {
		return NextResponse.json(
			{ error: e?.message || 'Update failed', databaseUrl: process.env.DATABASE_URL },
			{ status: 500 }
		);
	}
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const role = (session as any)?.user?.role as string | undefined;
		if (!canManageAll(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

		const id = params.id;
		if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

		// Soft delete
		await prisma.vendor.update({
			where: { id },
			data: { isActive: 0 },
		});

		return NextResponse.json({ ok: true });
	} catch (e: any) {
		return NextResponse.json(
			{ error: e?.message || 'Delete failed', databaseUrl: process.env.DATABASE_URL },
			{ status: 500 }
		);
	}
}
