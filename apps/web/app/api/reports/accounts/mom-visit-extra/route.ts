import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

function toNum(v: unknown): number {
	if (v === null || v === undefined) return 0;
	if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
	if (typeof v === 'string') {
		const n = Number(v);
		return Number.isFinite(n) ? n : 0;
	}
	if (typeof v === 'object' && v && typeof (v as any).toNumber === 'function') {
		const n = (v as any).toNumber();
		return typeof n === 'number' && Number.isFinite(n) ? n : 0;
	}
	const n = Number(v as any);
	return Number.isFinite(n) ? n : 0;
}

type BucketMetric = {
	count: number;
	amount: number;
	travelAmount: number;
	testAmount: number;
	totalAmount: number;
};

type Bucket = {
	centerWithExtra: BucketMetric;
	localHomeWithExtra: BucketMetric;
	outerHomeWithExtra: BucketMetric;
};

function emptyMetric(): BucketMetric {
	return {
		count: 0,
		amount: 0,
		travelAmount: 0,
		testAmount: 0,
		totalAmount: 0,
	};
}

function emptyBucket(): Bucket {
	return {
		centerWithExtra: emptyMetric(),
		localHomeWithExtra: emptyMetric(),
		outerHomeWithExtra: emptyMetric(),
	};
}

function addToMetric(metric: BucketMetric, travel: number, test: number) {
	const total = travel + test;
	if (total <= 0) return;

	metric.count += 1;
	metric.travelAmount += travel;
	metric.testAmount += test;
	metric.totalAmount += total;
	metric.amount += total;
}

export async function POST(req: Request) {
	try {
		const body = await req.json().catch(() => ({}));

		const {
			accountId,
			labId,
			vendorId,
			from,
			to,
		}: {
			accountId?: string | null;
			labId?: string | null;
			vendorId?: string | null;
			from?: string | null;
			to?: string | null;
		} = body || {};

		const where: any = {
			isActive: 1,
			status: 'Report - Completed',
		};

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

		const rows = await prisma.appointment.findMany({
			where,
			select: {
				apptAt: true,
				serviceType: true,
				visitType: true,
				extraChargeRs: true,
				testAmountRs: true,
				status: true,
			},
			orderBy: { apptAt: 'desc' },
			take: 500000,
		});

		const byMonth = new Map<string, Bucket>();

		for (const r of rows) {
			if (!r.apptAt) continue;

			const month = yyyymm(new Date(r.apptAt));
			const bucket = byMonth.get(month) ?? emptyBucket();

			const visit = (r.visitType || '').toUpperCase().trim();
			const svc = (r.serviceType || '').toLowerCase().trim();

			const travel = Math.max(0, toNum(r.extraChargeRs));
			const test = Math.max(0, toNum(r.testAmountRs));
			const total = travel + test;

			if (total > 0) {
				if (visit === 'CENTER') {
					addToMetric(bucket.centerWithExtra, travel, test);
				}

				if (svc === 'local' && visit === 'HOME') {
					addToMetric(bucket.localHomeWithExtra, travel, test);
				}

				if (svc === 'outer' && visit === 'HOME') {
					addToMetric(bucket.outerHomeWithExtra, travel, test);
				}
			}

			byMonth.set(month, bucket);
		}

		const rowsOut = Array.from(byMonth.entries())
			.sort((a, b) => (a[0] < b[0] ? 1 : -1))
			.map(([month, v]) => ({
				month,
				centerWithExtra: v.centerWithExtra,
				localHomeWithExtra: v.localHomeWithExtra,
				outerHomeWithExtra: v.outerHomeWithExtra,
			}));

		return NextResponse.json({ rows: rowsOut }, { status: 200 });
	} catch (e: any) {
		console.error('[accounts/mom] fatal:', e?.message, e?.stack);
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}