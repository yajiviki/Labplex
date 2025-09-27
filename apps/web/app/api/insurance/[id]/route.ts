import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';


export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
	try {
		const body = await req.json().catch(() => ({}));

		const name = String(body?.name || '').trim();
		if (!name) {
			return NextResponse.json({ error: 'Insurance name is required.' }, { status: 400 });
		}

		const data: any = {
			name,
			address: (body?.address ?? null) || null,
			phone: (body?.phone ?? null) || null,
		};

		// Optional code update (must remain unique if provided)
		if (typeof body?.code === 'string' && body.code.trim()) {
			data.code = body.code.trim();
		}

		const updated = await prisma.insuranceCompany.update({
			where: { id: params.id },
			data,
			select: {
				id: true,
				code: true,
				name: true,
				address: true,
				phone: true,
				isActive: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		return NextResponse.json(updated);
	} catch (e: any) {
		return NextResponse.json(
			{ error: e?.message || 'Update failed' },
			{ status: 500 }
		);
	}
}

// Soft delete (avoid FK errors with appointments)
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
	try {
		await prisma.insuranceCompany.update({
			where: { id: params.id },
			data: { isActive: 0 },
		});
		return NextResponse.json({ ok: true });
	} catch (e: any) {
		// If you truly want hard delete, you can switch to delete() here,
		// but it may fail if appointments exist.
		return NextResponse.json(
			{ error: e?.message || 'Delete failed' },
			{ status: 500 }
		);
	}
}
