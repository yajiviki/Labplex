import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';   // ✅ correct depth

type ImportRow = {
	vendorId?: string | null;
	tpaName?: string | null;
	insuranceName?: string | null;
	address?: string | null;
	phone?: string | null;
	createdAt?: string | null;
	updatedAt?: string | null;
};

function parseDate(s?: string | null): Date {
	if (!s) return new Date();
	const normalized = s.replace('T', ' ');
	const d = new Date(normalized);
	return isNaN(d.getTime()) ? new Date() : d;
}

async function nextVendorHumanId(): Promise<string> {
	const last = await prisma.vendor.findFirst({
		where: { vendorId: { startsWith: 'TPA' } },
		orderBy: { vendorId: 'desc' },
		select: { vendorId: true },
	});
	let max = 0;
	if (last?.vendorId?.startsWith('TPA')) {
		const tail = last.vendorId.slice(3);
		const n = parseInt(tail, 10);
		if (!isNaN(n)) max = n;
	}
	const n = max + 1;
	const tail = n < 10 ? `0${n}` : `${n}`;
	return `TPA${tail}`;
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const rows: ImportRow[] = Array.isArray(body?.rows) ? body.rows : [];
		if (rows.length === 0) {
			return NextResponse.json({ error: 'No rows supplied' }, { status: 400 });
		}

		let insertedVendors = 0;
		let updatedVendors = 0;
		let insertedCompanies = 0;
		let skippedCompanies = 0;

		for (const raw of rows) {
			const tpaName = (raw.tpaName || '').trim();
			const insuranceName = (raw.insuranceName || '').trim();
			const address = (raw.address || '').trim();
			const phone = (raw.phone || '').trim();
			const createdAt = parseDate(raw.createdAt ?? null);
			const updatedAt = parseDate(raw.updatedAt ?? null);

			if (!tpaName) { skippedCompanies++; continue; }

			// Prefer vendorId if present, else match exact tpaName (no CI "mode")
			let vendor =
				(raw.vendorId?.trim()
					? await prisma.vendor.findFirst({
						where: { vendorId: raw.vendorId.trim() },
						select: { id: true, vendorId: true, tpaName: true, address: true, phone: true },
					})
					: null) ||
				(await prisma.vendor.findFirst({
					where: { tpaName }, // exact match only
					select: { id: true, vendorId: true, tpaName: true, address: true, phone: true },
				}));

			if (!vendor) {
				const newHumanId = raw.vendorId?.trim() || (await nextVendorHumanId());
				vendor = await prisma.vendor.create({
					data: {
						vendorId: newHumanId,
						tpaName,
						address: address || null,
						phone: phone || '',
						isActive: 1,
						createdAt,
						updatedAt,
					},
					select: { id: true, vendorId: true, tpaName: true, address: true, phone: true },
				});
				insertedVendors++;
			} else {
				const updates: any = {};
				let needs = false;
				if (address && address !== (vendor.address || '')) { updates.address = address; needs = true; }
				if (phone && phone !== (vendor.phone || '')) { updates.phone = phone; needs = true; }
				if (needs) {
					updates.updatedAt = updatedAt;
					vendor = await prisma.vendor.update({
						where: { id: vendor.id },
						data: updates,
						select: { id: true, vendorId: true, tpaName: true, address: true, phone: true },
					});
					updatedVendors++;
				}
			}

			if (insuranceName) {
				const existingCompany = await prisma.insuranceCompany.findFirst({
					where: { vendorId: vendor.id, name: insuranceName },
					select: { id: true },
				});
				if (existingCompany) {
					await prisma.insuranceCompany.update({
						where: { id: existingCompany.id },
						data: { updatedAt },
					});
					skippedCompanies++;
				} else {
					await prisma.insuranceCompany.create({
						data: {
							vendorId: vendor.id,   // FK to Vendor.id
							name: insuranceName,
							isActive: 1,
							createdAt,
							updatedAt,
						},
					});
					insertedCompanies++;
				}
			}
		}

		return NextResponse.json({
			insertedVendors,
			updatedVendors,
			insertedCompanies,
			skippedCompanies,
		});
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Import error' }, { status: 500 });
	}
}
