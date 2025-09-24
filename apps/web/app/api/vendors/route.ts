import { NextResponse } from 'next/server';
import { auth } from '../../../lib/auth';      // ✅ correct path from app/api/vendors
import { prisma } from '../../../lib/db';      // ✅

export const dynamic = 'force-dynamic';

function nextVendorIdFrom(rows: { vendorId: string | null }[]) {
	const prefix = 'TPA';
	let max = 0;
	for (const r of rows) {
		const id = r.vendorId || '';
		if (id.startsWith(prefix)) {
			const tail = id.slice(prefix.length);
			const n = parseInt(tail, 10);
			if (!isNaN(n) && n > max) max = n;
		}
	}
	const n = max + 1;
	const tail = n < 10 ? `0${n}` : `${n}`;
	return `${prefix}${tail}`;
}

/* ---------- GET /api/vendors ---------- */
export async function GET(req: Request) {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const { searchParams } = new URL(req.url);
		const include = searchParams.get('include');

		if (include === 'companies') {
			const vendors = await prisma.vendor.findMany({
				where: { isActive: 1 },
				orderBy: { createdAt: 'desc' },
				select: {
					id: true,
					vendorId: true,
					tpaName: true,
					address: true,
					phone: true,
					insuranceName: true,    // legacy single-name field
					createdAt: true,
					companies: {
						where: { isActive: 1 },
						orderBy: { name: 'asc' },
						select: { id: true, name: true, code: true },
					},
				},
			});
			return NextResponse.json(vendors);
		}

		const vendors = await prisma.vendor.findMany({
			where: { isActive: 1 },
			orderBy: { createdAt: 'desc' },
			select: {
				id: true,
				vendorId: true,
				tpaName: true,
				insuranceName: true,
				address: true,
				phone: true,
				createdAt: true,
			},
		});
		return NextResponse.json(vendors);
	} catch (e: any) {
		return NextResponse.json(
			{ error: e?.message || 'Failed to load vendors', databaseUrl: process.env.DATABASE_URL },
			{ status: 500 },
		);
	}
}

/* ---------- POST /api/vendors ---------- */
export async function POST(req: Request) {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const body = await req.json().catch(() => ({}));
		const { tpaName, insuranceName, address } = body || {};
		let { phone } = body || {};

		if (!tpaName?.trim()) {
			return NextResponse.json({ error: 'TPA Name is required' }, { status: 400 });
		}

		const phoneDigits = String(phone || '').replace(/\D+/g, '');
		if (!phoneDigits) {
			return NextResponse.json({ error: 'Mobile is required' }, { status: 400 });
		}
		if (phoneDigits.length < 10 || phoneDigits.length > 15) {
			return NextResponse.json({ error: 'Please enter a valid Mobile number (10–15 digits).' }, { status: 400 });
		}

		// small retry loop to avoid P2002 on vendorId
		let attempts = 0;
		while (attempts < 5) {
			attempts++;
			try {
				const all = await prisma.vendor.findMany({ select: { vendorId: true } });
				const vendorId = nextVendorIdFrom(all);

				const created = await prisma.$transaction(async (tx) => {
					const vendor = await tx.vendor.create({
						data: {
							vendorId,
							tpaName: tpaName.trim(),
							insuranceName: (insuranceName || '').trim() || null, // legacy column
							address: (address || '').trim() || null,
							phone: phoneDigits,
							isActive: 1,
						},
						select: {
							id: true,
							vendorId: true,
							tpaName: true,
							insuranceName: true,
							address: true,
							phone: true,
							createdAt: true,
						},
					});

					// optional: also create a normalized insurance row
					if (insuranceName && insuranceName.trim()) {
						await tx.insuranceCompany.create({
							data: {
								vendorId: vendor.id,     // FK to Vendor.id
								name: insuranceName.trim(),
								isActive: 1,
							},
						});
					}

					return vendor;
				});

				return NextResponse.json(created, { status: 201 });
			} catch (e: any) {
				if (e?.code === 'P2002' && String(e?.meta?.target || '').includes('vendorId')) continue;
				throw e;
			}
		}

		return NextResponse.json(
			{ error: 'Could not allocate a unique TPA ID. Please retry.' },
			{ status: 409 },
		);
	} catch (e: any) {
		return NextResponse.json(
			{ error: e?.message || 'Create failed', databaseUrl: process.env.DATABASE_URL },
			{ status: 500 },
		);
	}
}
