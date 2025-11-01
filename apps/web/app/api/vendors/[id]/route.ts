import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PUT(
	req: Request,
	{ params }: { params: { id: string } }
) {
	try {
		const id = params.id;
		const body = await req.json().catch(() => ({}));

		const tpaName = String(body?.tpaName || '').trim();
		if (!tpaName) return NextResponse.json({ error: 'TPA Name is required.' }, { status: 400 });

		const data: any = {
			tpaName,
			nickName: (String(body?.nickName || '').trim() || null),
			address: (String(body?.address || '').trim() || null),
			phone: ((String(body?.phone || '')).replace(/\D+/g, '') || null),
			email: (String(body?.email || '').trim() || null),
		};

		// vendorId stays immutable here; if you want to allow edits, add it with validation.

		const updated = await prisma.vendor.update({
			where: { id },
			data,
			select: {
				id: true, vendorId: true, tpaName: true, nickName: true, address: true, phone: true, email: true, isActive: true, createdAt: true,
			},
		});

		return NextResponse.json(updated);
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Update failed' }, { status: 500 });
	}
}

export async function DELETE(
	_req: Request,
	{ params }: { params: { id: string } }
) {
	try {
		const id = params.id;

		// Soft delete (preferred so Lab mappings don’t explode)
		const out = await prisma.vendor.update({
			where: { id },
			data: { isActive: 0 },
			select: { id: true },
		});

		return NextResponse.json({ ok: true, id: out.id });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Delete failed' }, { status: 500 });
	}
}
