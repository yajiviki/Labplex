// app/api/reports/accounts/mom/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';


function parseYmdStart(v?: string | null) {
	if (!v) return null;
	const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!m) return null;
	return new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0);
}
function endOfDay(d: Date) {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function yyyymm(d: Date) {
	const p = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${p(d.getMonth() + 1)}`;
}

export async function POST(req: Request) {
	try {
		const body = await req.json().catch(() => ({}));
		const {
			accountId,     // insuranceCompanyId (optional)
			labId,         // optional
			vendorId,      // optional
			from,          // 'yyyy-mm-dd' (optional)
			to,            // 'yyyy-mm-dd' (optional)
		}: {
			accountId?: string | null;
			labId?: string | null;
			vendorId?: string | null;
			from?: string | null;
			to?: string | null;
		} = body || {};

		const where: any = { isActive: 1 };

		// date filter (inclusive)
		const gte = parseYmdStart(from || undefined);
		const lte = parseYmdStart(to || undefined);
		if (gte || lte) {
			where.apptAt = {};
			if (gte) where.apptAt.gte = gte;
			if (lte) where.apptAt.lte = endOfDay(lte!);
		}

		if (accountId) where.insuranceCompanyId = accountId;
		if (labId) where.labId = labId;
		if (vendorId) where.vendorId = vendorId;

		// Pull minimal fields and aggregate in JS (DB-agnostic).
		const rows = await prisma.appointment.findMany({
			where,
			select: {
				apptAt: true,
				serviceType: true,     // 'Local' | 'Outer' | etc
				extraChargeRs: true,   // number | null
			},
			take: 500000,            // keep generous but safe
			orderBy: { apptAt: 'desc' },
		});

		const bucket = new Map<string, { outerCases: number; extraAmount: number }>();
		for (const r of rows) {
			if (!r.apptAt) continue;
			const key = yyyymm(new Date(r.apptAt));
			const cur = bucket.get(key) || { outerCases: 0, extraAmount: 0 };
			if ((r.serviceType || '').toLowerCase() === 'outer') cur.outerCases += 1;
			if (r.extraChargeRs != null) cur.extraAmount += Number(r.extraChargeRs) || 0;
			bucket.set(key, cur);
		}

		const result = Array.from(bucket.entries())
			.sort((a, b) => (a[0] < b[0] ? 1 : -1)) // newest first
			.map(([month, v]) => ({ month, outerCases: v.outerCases, extraAmount: v.extraAmount }));

		return NextResponse.json({ rows: result }, { status: 200 });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
