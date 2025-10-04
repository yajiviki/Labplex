import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';
import { auth } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

// helper to generate next LB code at DB side safely
async function nextLabCode() {
	const last = await prisma.lab.findFirst({
		where: { labCode: { startsWith: 'LB' } },
		orderBy: { labCode: 'desc' },
		select: { labCode: true },
	});
	let max = 0;
	if (last?.labCode?.startsWith('LB')) {
		const tail = last.labCode.slice(2);
		const n = parseInt(tail, 10);
		if (!isNaN(n)) max = n;
	}
	const n = max + 1;
	return `LB${String(n).padStart(2, '0')}`;
}

// GET labs + vendors
export async function GET() {
	try {
		const labs = await prisma.lab.findMany({
			where: { isActive: 1 },
			orderBy: { createdAt: 'desc' },
			select: {
				id: true, labCode: true, name: true, nickName: true,
				address: true, phone: true, email: true, createdAt: true,
			},
		});

		// load mapping separately
		const links = await prisma.labVendor.findMany({
			where: { labId: { in: labs.map(l => l.id) } },
			select: {
				labId: true,
				vendor: { select: { id: true, vendorId: true, tpaName: true, nickName: true } },
			},
		});

		const byLab = new Map<string, { id: string; vendorId: string; tpaName: string; nickName: string | null }[]>();
		for (const lv of links) {
			const arr = byLab.get(lv.labId) || [];
			arr.push(lv.vendor);
			byLab.set(lv.labId, arr);
		}

		const data = labs.map(l => {
			const vendors = byLab.get(l.id) || [];
			return {
				...l,
				tpa: vendors.map(v => `${v.vendorId} - ${v.tpaName}`).join(', '),
				vendors,
			};
		});

		return NextResponse.json(data);
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Failed to load labs' }, { status: 500 });
	}
}

/** POST /api/labs : create lab + map TPAs */
export async function POST(req: Request) {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const body = await req.json().catch(() => ({}));
		const { labCode, name, nickName, address, phone, email, vendorIds } = body || {};

		const phoneDigits = String(phone || '').replace(/\D+/g, '');
		if (!name?.trim() || !phoneDigits) {
			return NextResponse.json({ error: 'Name and Mobile are required.' }, { status: 400 });
		}

		const created = await prisma.$transaction(async (tx) => {
			const code = labCode?.trim() || await nextLabCode();
			const lab = await tx.lab.create({
				data: {
					labCode: code,
					name: name.trim(),
					nickName: nickName?.trim() || null,
					address: address?.trim() || null,
					phone: phoneDigits,
					email: email?.trim() || null,
					isActive: 1,
				},
				select: {
					id: true, labCode: true, name: true, nickName: true, address: true, phone: true, email: true, createdAt: true
				},
			});

			if (Array.isArray(vendorIds) && vendorIds.length) {
				await tx.labVendor.createMany({
					data: vendorIds.map((vid: string) => ({ labId: lab.id, vendorId: vid })),
					skipDuplicates: true,
				});
			}

			return lab;
		});

		return NextResponse.json(created, { status: 201 });
	} catch (e: any) {
		if (e?.code === 'P2002') {
			return NextResponse.json({ error: 'Lab Code already exists' }, { status: 409 });
		}
		return NextResponse.json({ error: e?.message || 'Create failed' }, { status: 500 });
	}
}
