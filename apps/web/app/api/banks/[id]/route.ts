// app/api/banks/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
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

		const updated = await prisma.$transaction(async (tx) => {
			const bank = await tx.bank.update({
				where: { id: params.id },
				data: {
					bankName: bankName.trim(),
					accountName: accountName.trim(),
					accountNo: accountNo.trim(),
					ifsc: ifsc.trim().toUpperCase(),
					address: address?.trim() || null,
				},
				select: { id: true },
			});

			if (Array.isArray(vendorIds)) {
				await tx.bankVendor.deleteMany({
					where: {
						bankId: bank.id,
						NOT: { vendorId: { in: vendorIds } },
					},
				});

				await tx.bankVendor.createMany({
					data: vendorIds.map((vid: string) => ({ bankId: bank.id, vendorId: vid })),
					skipDuplicates: true,
				});
			}

			return bank;
		});

		return NextResponse.json({ ok: true, id: updated.id });
	} catch (e: any) {
		if (e?.code === 'P2002') {
			return NextResponse.json({ error: 'Account No already exists' }, { status: 409 });
		}
		return NextResponse.json({ error: e?.message || 'Update failed' }, { status: 500 });
	}
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		await prisma.bank.delete({ where: { id: params.id } });

		return NextResponse.json({ ok: true });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Delete failed' }, { status: 500 });
	}
}