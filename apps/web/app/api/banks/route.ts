// app/api/banks/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';
import { auth } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

async function nextBankId(tx?: typeof prisma) {
	const client = tx || prisma;

	const rows = await client.bank.findMany({
		where: { bankId: { startsWith: 'BK' } },
		select: { bankId: true },
		orderBy: { bankId: 'desc' },
		take: 100,
	});

	let max = 0;

	for (const row of rows) {
		const raw = row.bankId || '';
		if (!raw.startsWith('BK')) continue;
		const n = parseInt(raw.slice(2), 10);
		if (!isNaN(n) && n > max) max = n;
	}

	return `BK${String(max + 1).padStart(2, '0')}`;
}

export async function GET() {
	try {
		const banks = await prisma.bank.findMany({
			where: { isActive: 1 },
			orderBy: { createdAt: 'desc' },
			select: {
				id: true,
				bankId: true,
				bankName: true,
				accountName: true,
				accountNo: true,
				ifsc: true,
				address: true,
				createdAt: true,
			},
		});

		const links = await prisma.bankVendor.findMany({
			where: { bankId: { in: banks.map((b) => b.id) } },
			select: {
				bankId: true,
				vendor: {
					select: {
						id: true,
						vendorId: true,
						tpaName: true,
						nickName: true,
					},
				},
			},
		});

		const byBank = new Map<
			string,
			{ id: string; vendorId: string; tpaName: string; nickName: string | null }[]
		>();

		for (const bv of links) {
			const arr = byBank.get(bv.bankId) || [];
			arr.push(bv.vendor);
			byBank.set(bv.bankId, arr);
		}

		const data = banks.map((b) => {
			const vendors = byBank.get(b.id) || [];
			return {
				...b,
				tpa: vendors.map((v) => `${v.vendorId} - ${v.tpaName}`).join(', '),
				vendors,
			};
		});

		return NextResponse.json(data);
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Failed to load banks' }, { status: 500 });
	}
}

export async function POST(req: Request) {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const body = await req.json().catch(() => ({}));
		const { bankName, accountName, accountNo, ifsc, address, vendorIds } = body || {};

		if (!bankName?.trim() || !accountName?.trim() || !accountNo?.trim() || !ifsc?.trim()) {
			return NextResponse.json(
				{ error: 'Bank Name, Account Name, Account No and IFSC are required.' },
				{ status: 400 }
			);
		}

		const created = await prisma.$transaction(async (tx) => {
			const bankId = await nextBankId(tx as typeof prisma);

			const bank = await tx.bank.create({
				data: {
					bankId,
					bankName: bankName.trim(),
					accountName: accountName.trim(),
					accountNo: accountNo.trim(),
					ifsc: ifsc.trim().toUpperCase(),
					address: address?.trim() || null,
					isActive: 1,
				},
				select: {
					id: true,
					bankId: true,
					bankName: true,
					accountName: true,
					accountNo: true,
					ifsc: true,
					address: true,
					createdAt: true,
				},
			});

			if (Array.isArray(vendorIds) && vendorIds.length) {
				await tx.bankVendor.createMany({
					data: vendorIds.map((vid: string) => ({ bankId: bank.id, vendorId: vid })),
					skipDuplicates: true,
				});
			}

			return bank;
		});

		return NextResponse.json(created, { status: 201 });
	} catch (e: any) {
		if (e?.code === 'P2002') {
			return NextResponse.json({ error: 'Account No already exists' }, { status: 409 });
		}
		return NextResponse.json({ error: e?.message || 'Create failed' }, { status: 500 });
	}
}