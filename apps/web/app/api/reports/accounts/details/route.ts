import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseDateFlexible(s?: string) {
	if (!s) return null;
	let m = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
	if (m) return new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0);
	m = s.match(/^(\d{2})-(\d{2})-(\d{4})$/);
	if (m) return new Date(+m[3], +m[2] - 1, +m[1], 0, 0, 0, 0);
	return null;
}
function endOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999); }

export async function POST(req: Request) {
	try {
		const body = await req.json();
		const { from, to, labId, vendorId, serviceType, visitType, gender, extraMissing } = body || {};

		const fromDate = parseDateFlexible(from);
		const toStart = parseDateFlexible(to);
		if (!fromDate || !toStart) return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
		const toDate = endOfDay(toStart);

		const where: any = {
			isActive: 1,
			apptAt: { gte: fromDate, lte: toDate },
		};
		if (labId) where.labId = labId;
		if (vendorId) where.vendorId = vendorId;
		if (serviceType) where.serviceType = serviceType;
		if (visitType) where.visitType = visitType;
		if (gender) where.gender = gender;
		if (extraMissing) {
			// treat null OR 0 as missing amount
			where.OR = [{ extraChargeRs: null }, { extraChargeRs: 0 }];
		}

		const rows = await prisma.appointment.findMany({
			where,
			orderBy: [{ apptAt: 'desc' }],
			select: {
				id: true,
				apptAt: true,
				clientName: true,
				gender: true,
				status: true,
				visitType: true,
				serviceType: true,
				extraChargeRs: true,
				lab: { select: { name: true, nickName: true } },
				vendor: { select: { tpaName: true, nickName: true } },
				insuranceCompany: { select: { name: true, nickName: true } },
			},
		});

		// shape for client
		const shaped = rows.map(r => ({
			id: r.id,
			apptAt: r.apptAt.toISOString(),
			labName: r.lab?.nickName ?? r.lab?.name ?? null,
			tpaName: r.vendor?.nickName ?? r.vendor?.tpaName ?? null,
			insuranceNickName: r.insuranceCompany?.nickName ?? r.insuranceCompany?.name ?? null,
			clientName: r.clientName ?? null,
			gender: r.gender ?? null,
			status: r.status ?? null,
			visitType: r.visitType ?? null,
			serviceType: r.serviceType ?? null,
			extraChargeRs: r.extraChargeRs ?? null,
		}));

		return NextResponse.json({ rows: shaped });
	} catch (e: any) {
		console.error('[reports/accounts/details] fatal:', e?.message, e?.stack);
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
