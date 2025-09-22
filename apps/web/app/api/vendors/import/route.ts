// app/api/vendors/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';


type ImportRow = {
	vendorId: string;
	tpaName: string;
	insuranceName: string | null;
	address: string | null;
	phone: string;         // NOT NULL in your schema
	createdAt?: string | null;
	updatedAt?: string | null;
};

// helper to parse date string or now()
function parseDate(s?: string | null): Date {
	if (!s) return new Date();
	// Accept "YYYY-MM-DD HH:MM:SS"
	const normalized = s.replace('T', ' ');
	const d = new Date(normalized);
	return isNaN(d.getTime()) ? new Date() : d;
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const rows: ImportRow[] = Array.isArray(body?.rows) ? body.rows : [];
		if (rows.length === 0) {
			return NextResponse.json({ error: 'No rows supplied' }, { status: 400 });
		}

		let inserted = 0;
		let updated = 0;
		let skipped = 0;

		debugger;
		// NOTE: If you have UNIQUE constraint on Vendor.vendorId,
		// multiple entries for same vendorId will be updated (upsert) instead of inserted duplicates.
		for (const r of rows) {
			if (!r.vendorId || !r.tpaName || r.phone == null) { skipped++; continue; }

			const data = {
				vendorId: r.vendorId,
				tpaName: r.tpaName,
				insuranceName: r.insuranceName,
				address: r.address,
				phone: r.phone,
				createdAt: parseDate(r.createdAt ?? undefined),
				updatedAt: parseDate(r.updatedAt ?? undefined),
			};

			// Try upsert by vendorId (assumes vendorId is unique in Prisma schema)
			try {
				await prisma.vendor.upsert({
					where: { vendorId: r.vendorId },
					create: { id: crypto.randomUUID(), ...data },
					update: {
						tpaName: data.tpaName,
						insuranceName: data.insuranceName,
						address: data.address,
						phone: data.phone,
						// keep original createdAt, only bump updatedAt
						updatedAt: data.updatedAt,
					},
				});
				// count as inserted if not existing previously
				// small check:
				// You can instead fetch first; keeping simple:
				inserted++; // treat upsert as inserted; adjust if you need true diff
			} catch (e: any) {
				// If vendorId is not unique in DB and duplicates exist, fallback to createMany skip
				skipped++;
			}
		}

		return NextResponse.json({ inserted, updated, skipped });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Import error' }, { status: 500 });
	}
}
