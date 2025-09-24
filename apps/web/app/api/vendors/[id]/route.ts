import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';  // ✅ correct depth
import { auth } from '../../../../lib/auth';

export async function POST(req: Request, { params }: { params: { id: string } }) {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const id = params.id;
		const body = await req.json().catch(() => ({}));
		const name = (body?.name || '').trim();

		if (!id) return NextResponse.json({ error: 'Missing vendor id' }, { status: 400 });
		if (!name) return NextResponse.json({ error: 'Insurance name required' }, { status: 400 });

		const vendor = await prisma.vendor.findUnique({ where: { id }, select: { id: true } });
		if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });

		const existing = await prisma.insuranceCompany.findFirst({
			where: { vendorId: vendor.id, name },
			select: { id: true },
		});
		if (existing) {
			return NextResponse.json({ ok: true, existed: true });
		}

		await prisma.insuranceCompany.create({
			data: { vendorId: vendor.id, name, isActive: 1 },
		});

		return NextResponse.json({ ok: true });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
