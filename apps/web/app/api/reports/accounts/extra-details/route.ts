// app/api/accounts/extra-details/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toYmd(d: Date) {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export async function POST(req: Request) {
	try {
		const { ids } = await req.json();
		if (!Array.isArray(ids) || ids.length === 0) {
			return NextResponse.json({ items: [] });
		}

		const rows = await prisma.appointment.findMany({
			where: { id: { in: ids }, isActive: 1 },
			orderBy: { apptAt: 'desc' },
			select: {
				id: true,
				apptAt: true,
				status: true,
				clientName: true,
				clientRef: true,
				extraChargeRs: true,
				lab: { select: { name: true } },                 // relation names as per your schema
				vendor: { select: { tpaName: true } },
				insuranceCompany: { select: { name: true } },
			},
			take: 50000,
		});

		const items = rows.map(r => ({
			id: r.id,
			apptAt: r.apptAt ? toYmd(new Date(r.apptAt)) : '',
			labName: r.lab?.name ?? '',
			status: r.status ?? '',
			tpaName: r.vendor?.tpaName ?? '',
			insurance: r.insuranceCompany?.name ?? '',
			clientName: r.clientName ?? '',
			ref: r.clientRef ?? '',
			extraAmount: r.extraChargeRs ? Number(r.extraChargeRs) : 0,
		}));

		return NextResponse.json({ items });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
