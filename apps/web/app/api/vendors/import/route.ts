import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';


// Generate next vendorId (TPAxx) from DB
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

function normPhone(v: any) {
	const s = String(v ?? '').replace(/\D+/g, '');
	return s ? s : null;
}
function normStr(v: any) {
	const s = String(v ?? '').trim();
	return s ? s : null;
}

export async function POST(req: Request) {
	try {
		const body = await req.json().catch(() => ({}));
		const rows = Array.isArray(body?.rows) ? body.rows : [];
		if (!rows.length) {
			return NextResponse.json({ error: 'No rows provided', inserted: 0, upserted: 0, skipped: 0, total: 0 }, { status: 400 });
		}

		let inserted = 0;
		let upserted = 0;
		let skipped = 0;

		// Process sequentially to keep nextVendorId monotonic if many new rows have no vendorId
		for (const r of rows) {
			const tpaName = normStr(r?.tpaName);
			if (!tpaName) { skipped++; continue; }

			let vendorId = normStr(r?.vendorId); // may be null
			const address = normStr(r?.address);
			const phone = normPhone(r?.phone);
			const email = normStr(r?.email);

			// If vendorId present -> upsert by vendorId (unique)
			if (vendorId) {
				const existing = await prisma.vendor.findUnique({ where: { vendorId } });
				if (existing) {
					await prisma.vendor.update({
						where: { vendorId },
						data: { tpaName, address, phone, email, isActive: 1 },
					});
					upserted++;
				} else {
					await prisma.vendor.create({
						data: { vendorId, tpaName, address, phone, email, isActive: 1 },
					});
					inserted++;
				}
				continue;
			}

			// No vendorId => try match by tpaName (case-insensitive) to avoid duplicates
			const byName = await prisma.vendor.findFirst({
				where: { tpaName: { equals: tpaName, mode: 'insensitive' } },
			});

			if (byName) {
				await prisma.vendor.update({
					where: { id: byName.id },
					data: { tpaName, address, phone, email, isActive: 1 },
				});
				upserted++;
			} else {
				// brand new; assign next code
				const nextCode = await nextVendorIdFromDb();
				await prisma.vendor.create({
					data: { vendorId: nextCode, tpaName, address, phone, email, isActive: 1 },
				});
				inserted++;
			}
		}

		return NextResponse.json({
			inserted, upserted, skipped, total: rows.length,
		});
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Import failed' }, { status: 500 });
	}
}
