import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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

export async function POST(req: Request) {
	try {
		const body = await req.json().catch(() => ({}));
		const rows: Array<{
			vendorId?: string | null;
			tpaName: string;
			nickName?: string | null;
			address?: string | null;
			phone?: string | null;
			email?: string | null;
		}> = Array.isArray(body?.rows) ? body.rows : [];

		if (!rows.length) {
			return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
		}

		let inserted = 0, upserted = 0, skipped = 0;

		for (const r of rows) {
			const tpaName = String(r.tpaName || '').trim();
			if (!tpaName) { skipped++; continue; }

			const nickName = (r.nickName ? String(r.nickName).trim() : null) || null;
			const address = (r.address ? String(r.address).trim() : null) || null;
			const phone = ((r.phone ? String(r.phone) : '').replace(/\D+/g, '') || null);
			const email = (r.email ? String(r.email).trim() : null) || null;

			let vendorId = r.vendorId ? String(r.vendorId).trim() : null;
			if (!vendorId) vendorId = await nextVendorIdFromDb();

			const existing = await prisma.vendor.findUnique({ where: { vendorId } });

			if (existing) {
				await prisma.vendor.update({
					where: { vendorId },
					data: { tpaName, nickName, address, phone, email, isActive: 1 },
				});
				upserted++;
			} else {
				await prisma.vendor.create({
					data: { vendorId, tpaName, nickName, address, phone, email, isActive: 1 },
				});
				inserted++;
			}
		}

		return NextResponse.json({ inserted, upserted, skipped });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Import failed' }, { status: 500 });
	}
}
