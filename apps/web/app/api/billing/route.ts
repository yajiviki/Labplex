// app/api/billing/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseYmd(s?: string | null) {
	if (!s) return null;
	const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!m) return null;
	const d = new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0);
	return Number.isNaN(d.getTime()) ? null : d;
}
function endOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999); }

export async function GET(req: Request) {
	try {
		const url = new URL(req.url);
		const from = url.searchParams.get('from');
		const to = url.searchParams.get('to');
		const labId = url.searchParams.get('labId') || undefined;
		const vendorId = url.searchParams.get('vendorId') || undefined;
		const status = (url.searchParams.get('status') || '') as 'Paid' | 'NotPaid' | '';
		const sort = (url.searchParams.get('sort') || 'paidDate') as 'paidDate' | 'amount' | 'status' | 'labId' | 'vendorId';
		const dir = (url.searchParams.get('dir') || 'desc') as 'asc' | 'desc';
		const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
		const pageSize = Math.min(200, Math.max(1, parseInt(url.searchParams.get('pageSize') || '50', 10)));

		const fromDate = parseYmd(from);
		const toStart = parseYmd(to);
		if (!fromDate || !toStart) return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
		const toDate = endOfDay(toStart);

		const where: any = {
			paidDate: { gte: fromDate, lte: toDate },
		};
		if (labId) where.labId = labId;
		if (vendorId) where.vendorId = vendorId;
		if (status) where.status = status;

		const total = await prisma.billing.count({ where });

		const rows = await prisma.billing.findMany({
			where,
			orderBy: [{ [sort]: dir }],
			skip: (page - 1) * pageSize,
			take: pageSize,
			select: {
				id: true,
				labId: true,
				vendorId: true,
				paidDate: true,
				amount: true,             // Decimal
				status: true,
				remarks: true,
				lab: { select: { name: true } },
				vendor: { select: { tpaName: true } },
			},
		});

		const shaped = rows.map(r => ({
			id: r.id,
			labId: r.labId,
			vendorId: r.vendorId,
			paidDate: r.paidDate.toISOString(),
			amount: typeof (r as any).amount?.toNumber === 'function'
				? (r as any).amount.toNumber()
				: Number(r.amount),
			status: r.status,
			remarks: r.remarks,
			lab: r.lab ? { name: r.lab.name } : { name: '' },
			vendor: r.vendor ? { tpaName: r.vendor.tpaName } : { tpaName: '' },
		}));

		return NextResponse.json({ total, rows: shaped });
	} catch (e: any) {
		console.error('[billing][GET] fatal:', e?.message, e?.stack);
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}

export async function POST(req: Request) {
	try {
		const body = await req.json().catch(() => ({}));
		const labId = String(body?.labId || '').trim();
		const vendorId = String(body?.vendorId || '').trim();
		const paidDateStr = String(body?.paidDate || '').trim(); // YYYY-MM-DD
		const amount = Number(body?.amount);
		const status = String(body?.status || '').trim() as 'Paid' | 'NotPaid';
		const remarks = (body?.remarks ?? null) as string | null;

		if (!labId || !vendorId || !paidDateStr || !Number.isFinite(amount)) {
			return NextResponse.json({ error: 'Missing/invalid fields.' }, { status: 400 });
		}
		const d = parseYmd(paidDateStr);
		if (!d) return NextResponse.json({ error: 'Invalid paid date' }, { status: 400 });

		const created = await prisma.billing.create({
			data: { labId, vendorId, paidDate: d, amount, status, remarks },
			select: { id: true, labId: true, vendorId: true, paidDate: true, amount: true, status: true, remarks: true },
		});

		return NextResponse.json({
			...created,
			paidDate: created.paidDate.toISOString(),
			amount: typeof (created as any).amount?.toNumber === 'function'
				? (created as any).amount.toNumber()
				: Number(created.amount),
		}, { status: 201 });
	} catch (e: any) {
		console.error('[billing][POST] fatal:', e?.message, e?.stack);
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
