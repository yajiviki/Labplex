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
function normalizeServiceType(s?: string | null): 'Local' | 'Outer' | null {
	const v = (s || '').trim().toLowerCase();
	if (v === 'local' || v === 'l') return 'Local';
	if (v === 'outer' || v === 'o') return 'Outer';
	return null;
}
function normalizeVisitType(s?: string | null): 'HOME' | 'CENTER' | null {
	const v = (s || '').trim().toLowerCase();
	if (v === 'home' || v === 'h' || v === 'home visit') return 'HOME';
	if (v === 'center' || v === 'centre' || v === 'c' || v === 'center visit' || v === 'centre visit') return 'CENTER';
	return null;
}

const COMPLETED_STATUSES = ['Report - Completed', 'Completed'];

export async function POST(req: Request) {
	try {
		const body = await req.json();
		const { from, to, labId, vendorId, serviceType, visitType, extraMissing, reportCompletedOnly } = body || {};

		const fromDate = parseDateFlexible(from);
		const toStart = parseDateFlexible(to);
		if (!fromDate || !toStart) return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
		const toDate = endOfDay(toStart);

		const where: any = {
			isActive: 1,
			apptAt: { gte: fromDate, lte: toDate },
			...(labId ? { labId } : {}),
			...(vendorId ? { vendorId } : {}),
			...(reportCompletedOnly ? { status: { in: COMPLETED_STATUSES } } : {}), // default true in client for pivot clicks
			...(extraMissing ? { OR: [{ extraChargeRs: null }, { extraChargeRs: 0 }] } : {}),
		};

		const rows = await prisma.appointment.findMany({
			where,
			orderBy: [{ apptAt: 'desc' }],
			select: {
				id: true,
				apptAt: true,
				clientName: true,
				status: true,
				visitType: true,
				serviceType: true,
				extraChargeRs: true,
				lab: { select: { name: true, nickName: true } },
				vendor: { select: { tpaName: true, nickName: true } },
				insuranceCompany: { select: { name: true, nickName: true } },
			},
		});

		const wantST = normalizeServiceType(serviceType ?? null);
		const wantVT = normalizeVisitType(visitType ?? null);

		const shaped = rows
			.map(r => {
				const st = normalizeServiceType(r.serviceType);
				const vt = normalizeVisitType(r.visitType);
				return {
					id: r.id,
					apptAt: r.apptAt.toISOString(),
					labName: r.lab?.nickName ?? r.lab?.name ?? null,
					tpaName: r.vendor?.nickName ?? r.vendor?.tpaName ?? null,
					insuranceNickName: r.insuranceCompany?.nickName ?? r.insuranceCompany?.name ?? null,
					clientName: r.clientName ?? null,
					status: r.status ?? null,
					visitType: vt,
					serviceType: st,
					extraChargeRs: r.extraChargeRs ?? null,
				};
			})
			.filter(r => (wantST ? r.serviceType === wantST : true))
			.filter(r => (wantVT ? r.visitType === wantVT : true));

		return NextResponse.json({ rows: shaped });
	} catch (e: any) {
		console.error('[reports/accounts/details] fatal:', e?.message, e?.stack);
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
