import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';


export async function PUT(
	req: Request,
	{ params }: { params: { id: string } }
) {
	try {
		const id = params.id;
		const body = await req.json().catch(() => ({}));

		const tpaName = String(body?.tpaName || '').trim();
		if (!tpaName) return NextResponse.json({ error: 'TPA Name is required.' }, { status: 400 });

		const phone = (String(body?.phone || '') || '').replace(/\D+/g, '') || null;
		const address = (String(body?.address || '') || '').trim() || null;
		const email = (String(body?.email || '') || '').trim() || null;

		// Do NOT change vendorId here (keep code stable)
		const updated = await prisma.vendor.update({
			where: { id },
			data: {
				tpaName,
				address,
				phone,
				email,
			},
			select: {
				id: true, vendorId: true, tpaName: true, address: true, phone: true, email: true, createdAt: true,
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
		await prisma.vendor.delete({ where: { id } });
		return NextResponse.json({ ok: true });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Delete failed' }, { status: 500 });
	}
}
