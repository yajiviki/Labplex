// app/api/accounts/extra-pivot/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function monthBounds(d = new Date()) {
	const y = d.getFullYear(), m = d.getMonth();
	const start = new Date(y, m, 1, 0, 0, 0, 0);
	const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
	return { start, end };
}
function prevMonthBounds(d = new Date()) {
	const y = d.getFullYear(), m = d.getMonth();
	const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
	const end = new Date(y, m, 0, 23, 59, 59, 999);
	return { start, end };
}

export async function POST(req: Request) {
	try {
		const { insuranceCompanyId, labId, vendorId } = await req.json().catch(() => ({}));

		const filterBase: any = { isActive: 1 };
		if (insuranceCompanyId) filterBase.insuranceCompanyId = insuranceCompanyId;
		if (labId) filterBase.labId = labId;
		if (vendorId) filterBase.vendorId = vendorId;

		// "Outer case" interpreted as serviceType = 'Outer'
		const { start: curStart, end: curEnd } = monthBounds();
		const { start: prevStart, end: prevEnd } = prevMonthBounds();

		const [cur, prev] = await Promise.all([
			prisma.appointment.findMany({
				where: {
					...filterBase,
					apptAt: { gte: curStart, lte: curEnd },
					serviceType: 'Outer',
				},
				select: { id: true, extraChargeRs: true },
				take: 50000,
			}),
			prisma.appointment.findMany({
				where: {
					...filterBase,
					apptAt: { gte: prevStart, lte: prevEnd },
					serviceType: 'Outer',
				},
				select: { id: true, extraChargeRs: true },
				take: 50000,
			}),
		]);

		const sum = (xs: { extraChargeRs: any }[]) =>
			xs.reduce((a, x) => a + (x.extraChargeRs ? Number(x.extraChargeRs) : 0), 0);

		const payload = {
			current: {
				month: new Date().toLocaleString('en-GB', { month: 'short', year: 'numeric' }),
				outerCount: cur.length,
				extraAmount: +sum(cur).toFixed(2),
			},
			previous: {
				month: new Date(prevStart).toLocaleString('en-GB', { month: 'short', year: 'numeric' }),
				outerCount: prev.length,
				extraAmount: +sum(prev).toFixed(2),
			},
			// ids for drill downs
			currentIds: cur.map(x => x.id),
			previousIds: prev.map(x => x.id),
		};

		return NextResponse.json(payload);
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
