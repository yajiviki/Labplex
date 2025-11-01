// app/api/billing/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseYmd(s?: string | null) {
	if (!s) return null;
	const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!m) return null;
	const d = new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0);
	return Number.isNaN(d.getTime()) ? null : d;
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
	try {
		const id = params.id;
		const body = await req.json().catch(() => ({}));

		const labId = String(body?.labId || '').trim();
		const vendorId = String(body?.vendorId || '').trim();
		const paidDateStr = String(body?.paidDate || '').trim(); // YYYY-MM-DD
		const amount = Number(body?.amount);
		const status = String(body?.status || '').trim() as 'Paid' | 'NotPaid';
		const remarks = (body?.remarks ?? null) as string | null;

		if (!id || !labId || !vendorId || !paidDateStr || !Number.isFinite(amount)) {
			return NextResponse.json({ error: 'Missing/invalid fields.' }, { status: 400 });
		}
		const d = parseYmd(paidDateStr);
		if (!d) return NextResponse.json({ error: 'Invalid paid date' }, { status: 400 });

		const updated = await prisma.billing.update({
			where: { id },
			data: { labId, vendorId, paidDate: d, amount, status, remarks },
			select: { id: true },
		});

		return NextResponse.json(updated);
	} catch (e: any) {
		console.error('[billing][PUT] fatal:', e?.message, e?.stack);
		return NextResponse.json({ error: e?.message || 'Update failed' }, { status: 500 });
	}
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
	try {
		const id = params.id;
		if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

		await prisma.billing.delete({ where: { id } });
		return NextResponse.json({ ok: true });
	} catch (e: any) {
		console.error('[billing][DELETE] fatal:', e?.message, e?.stack);
		return NextResponse.json({ error: e?.message || 'Delete failed' }, { status: 500 });
	}
}
