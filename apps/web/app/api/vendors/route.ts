import { NextResponse } from 'next/server';
import { auth } from '../../../lib/auth';
import { prisma } from '../../../lib/db';


function nextVendorIdFromExisting(ids: string[]) {
	const prefix = 'TPA';
	let max = 0;
	for (const id of ids) {
		if (id?.startsWith(prefix)) {
			const tail = id.slice(prefix.length);
			const n = parseInt(tail, 10);
			if (!isNaN(n) && n > max) max = n;
		}
	}
	const n = max + 1;
	const tail = n < 10 ? `0${n}` : `${n}`;
	return `${prefix}${tail}`;
}

export async function GET() {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const items = await prisma.vendor.findMany({
			where: { isActive: 1 },
			orderBy: { createdAt: 'desc' },
			select: {
				id: true, vendorId: true, tpaName: true, insuranceName: true,
				address: true, phone: true, createdAt: true,
			},
		});
		return NextResponse.json(items);
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}

export async function POST(req: Request) {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const { tpaName, insuranceName, address, phone } = await req.json().catch(() => ({}));
		const normalizedPhone = (phone || '').toString().replace(/\D+/g, '');
		if (!tpaName?.trim() || !normalizedPhone) {
			return NextResponse.json({ error: 'Please fill TPA Name and Mobile.' }, { status: 400 });
		}

		// Generate next vendorId
		const all = await prisma.vendor.findMany({ select: { vendorId: true } });
		const vid = nextVendorIdFromExisting(all.map(a => a.vendorId || ''));

		const created = await prisma.vendor.create({
			data: {
				vendorId: vid,
				tpaName: tpaName.trim(),
				insuranceName: (insuranceName || null),
				address: (address || null),
				phone: normalizedPhone,
				isActive: 1,
			},
			select: {
				id: true, vendorId: true, tpaName: true, insuranceName: true,
				address: true, phone: true, createdAt: true,
			},
		});
		return NextResponse.json(created, { status: 201 });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
