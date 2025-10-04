import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';

// Helper to compute next TPA code from DB, e.g. TPA01, TPA02...
async function nextVendorIdFromDb() {
	const prefix = 'TPA';
	const all = await prisma.vendor.findMany({
		where: { vendorId: { startsWith: prefix } },
		select: { vendorId: true },
	});
	let max = 0;
	for (const r of all) {
		const v = r.vendorId || '';
		if (v.startsWith(prefix)) {
			const n = parseInt(v.slice(prefix.length), 10);
			if (!Number.isNaN(n) && n > max) max = n;
		}
	}
	return `${prefix}${String(max + 1).padStart(2, '0')}`;
}

export async function GET() {
	try {
		const rows = await prisma.vendor.findMany({
			where: { isActive: 1 },
			orderBy: { createdAt: 'desc' },
			select: {
				id: true,
				vendorId: true,
				tpaName: true,
				nickName: true,   // ← added
				address: true,
				phone: true,
				email: true,
				isActive: true,
				createdAt: true,
			},
		});
		return NextResponse.json(rows);
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'List failed' }, { status: 500 });
	}
}

export async function POST(req: Request) {
	try {
		const body = await req.json().catch(() => ({}));
		const tpaName = String(body?.tpaName || '').trim();
		if (!tpaName) return NextResponse.json({ error: 'TPA Name is required.' }, { status: 400 });

		let vendorId: string | null | undefined = body?.vendorId ?? null;
		if (!vendorId) vendorId = await nextVendorIdFromDb();

		const phone = (String(body?.phone || '') || '').replace(/\D+/g, '') || null;
		const address = (String(body?.address || '') || '').trim() || null;
		const email = (String(body?.email || '') || '').trim() || null;
		const nickName = (String(body?.nickName || '') || '').trim() || null; // ← added

		const created = await prisma.vendor.create({
			data: {
				vendorId,
				tpaName,
				nickName,  // ← added
				address,
				phone,
				email,
				isActive: 1,
			},
			select: {
				id: true, vendorId: true, tpaName: true, nickName: true, address: true, phone: true, email: true, createdAt: true,
			},
		});

		return NextResponse.json(created, { status: 201 });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Create failed' }, { status: 500 });
	}
}
