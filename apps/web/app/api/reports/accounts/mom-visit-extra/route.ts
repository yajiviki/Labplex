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

type Bucket = {
	centerWithExtra: { count: number; amount: number };
	localHomeWithExtra: { count: number; amount: number };
	outerHomeWithExtra: { count: number; amount: number };
};

export async function POST(req: Request) {
	try {
		const body = await req.json().catch(() => ({}));
		const {
			accountId,   // insuranceCompanyId (optional)
			labId,       // optional
			vendorId,    // optional
			from,        // 'yyyy-mm-dd' (optional)
			to,          // 'yyyy-mm-dd' (optional)
		}: {
			accountId?: string | null;
			labId?: string | null;
			vendorId?: string | null;
			from?: string | null;
			to?: string | null;
		} = body || {};

		const where: any = { isActive: 1 };

		const gte = parseYmdStart(from || undefined);
		const lte0 = parseYmdStart(to || undefined);
		if (gte || lte0) {
			where.apptAt = {};
			if (gte) where.apptAt.gte = gte;
			if (lte0) where.apptAt.lte = endOfDay(lte0);
		}
		if (accountId) where.insuranceCompanyId = accountId;
		if (labId) where.labId = labId;
		if (vendorId) where.vendorId = vendorId;

		// Pull only what we need; aggregate in JS (keeps it DB-agnostic).
		const rows = await prisma.appointment.findMany({
			where,
			select: {
				apptAt: true,
				serviceType: true,     // 'Local' | 'Outer' | etc
				visitType: true,       // 'CENTER' | 'HOME'
				extraChargeRs: true,   // number | null
			},
			orderBy: { apptAt: 'desc' },
			take: 500000,
		});

		const byMonth = new Map<string, Bucket>();

		for (const r of rows) {
			if (!r.apptAt) continue;
			const month = yyyymm(new Date(r.apptAt));
			const b = byMonth.get(month) ?? {
				centerWithExtra: { count: 0, amount: 0 },
				localHomeWithExtra: { count: 0, amount: 0 },
				outerHomeWithExtra: { count: 0, amount: 0 },
			};

			const visit = (r.visitType || '').toUpperCase();    // 'CENTER' | 'HOME'
			const svc = (r.serviceType || '').toLowerCase();    // 'local' | 'outer' | ...
			const extra = (r.extraChargeRs ?? 0) > 0 ? Number(r.extraChargeRs) : 0;

			if (extra > 0) {
				// 1) Center visit with Extra (any service type)
				if (visit === 'CENTER') {
					b.centerWithExtra.count += 1;
					b.centerWithExtra.amount += extra;
				}
				// 2) Local + Home with Extra
				if (svc === 'local' && visit === 'HOME') {
					b.localHomeWithExtra.count += 1;
					b.localHomeWithExtra.amount += extra;
				}
				// 3) Outer + Home with Extra
				if (svc === 'outer' && visit === 'HOME') {
					b.outerHomeWithExtra.count += 1;
					b.outerHomeWithExtra.amount += extra;
				}
			}

			byMonth.set(month, b);
		}

		const rowsOut = Array.from(byMonth.entries())
			.sort((a, b) => (a[0] < b[0] ? 1 : -1)) // newest first
			.map(([month, v]) => ({
				month,
				centerWithExtra: v.centerWithExtra,
				localHomeWithExtra: v.localHomeWithExtra,
				outerHomeWithExtra: v.outerHomeWithExtra,
			}));

		return NextResponse.json({ rows: rowsOut }, { status: 200 });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
