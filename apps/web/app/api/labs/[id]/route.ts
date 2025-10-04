import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

/** PUT /api/labs/[id] : update lab + replace mapped TPAs */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const id = params.id;
		const body = await req.json().catch(() => ({}));
		const { name, nickName, address, phone, email, vendorIds } = body || {};

		const phoneDigits = String(phone || '').replace(/\D+/g, '');
		if (!name?.trim() || !phoneDigits) {
			return NextResponse.json({ error: 'Name and Mobile are required.' }, { status: 400 });
		}

		const updated = await prisma.$transaction(async (tx) => {
			const lab = await tx.lab.update({
				where: { id },
				data: {
					name: name.trim(),
					nickName: nickName?.trim() || null,
					address: address?.trim() || null,
					phone: phoneDigits,
					email: email?.trim() || null,
				},
				select: { id: true },
			});

			if (Array.isArray(vendorIds)) {
				await tx.labVendor.deleteMany({
					where: {
						labId: lab.id,
						NOT: { vendorId: { in: vendorIds } },
					},
				});
				await tx.labVendor.createMany({
					data: vendorIds.map((vid: string) => ({ labId: lab.id, vendorId: vid })),
					skipDuplicates: true,
				});
			}

			return lab;
		});

		return NextResponse.json({ ok: true, id: updated.id });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Update failed' }, { status: 500 });
	}
}

/** DELETE /api/labs/[id] : hard delete */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		await prisma.lab.delete({ where: { id: params.id } });

		return NextResponse.json({ ok: true });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Delete failed' }, { status: 500 });
	}
}
