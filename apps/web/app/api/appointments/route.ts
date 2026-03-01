// app/api/appointments/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';
import { auth } from '../../../lib/auth';

/* ---------- Helpers ---------- */
function parseDateOnlyStart(v?: string | null) {
	if (!v) return null;
	const a = v.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
	if (a) return new Date(+a[1], +a[2] - 1, +a[3], 0, 0, 0, 0);
	const b = v.match(/^(\d{2})-(\d{2})-(\d{4})$/);
	if (b) return new Date(+b[3], +b[2] - 1, +b[1], 0, 0, 0, 0);
	const d = new Date(v);
	return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function endOfDay(d: Date) {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function parseISOOrNull(v?: string | null) {
	if (!v) return null;
	const d = new Date(v);
	return Number.isNaN(d.getTime()) ? null : d;
}
function isoOrNull(d?: Date | null) {
	return d ? new Date(d).toISOString() : null;
}
function buildTestSummary(t?: {
	bloodTest: 'No' | 'FB' | 'B';
	urineTest: boolean;
	ecg: boolean;
	tmt: boolean;
	applicationForm: 'MER' | 'FMR' | 'ALL' | null;
}) {
	if (!t) return '';
	const parts: string[] = [];
	if (t.bloodTest && t.bloodTest !== 'No') parts.push(t.bloodTest);
	if (t.urineTest) parts.push('U');
	if (t.ecg) parts.push('ECG');
	if (t.tmt) parts.push('TMT');
	if (t.applicationForm) parts.push(t.applicationForm);
	return parts.join(',');
}

/** safe number parser (keeps null if empty) */
function toNumberOrNull(v: any): number | null {
	if (v === null || v === undefined || v === '') return null;
	const n = typeof v === 'number' ? v : Number(v);
	return Number.isFinite(n) ? n : null;
}

/**
 * GET /api/appointments
 * Query params: q, status, vendorId, labId, insuranceCompanyId, dateFrom(yyyy-mm-dd), dateTo(yyyy-mm-dd)
 */
export async function GET(req: Request) {
	try {
		const session = await auth();
		const sessionLabId = (session as any)?.labId as string | undefined;

		const { searchParams } = new URL(req.url);
		const q = searchParams.get('q')?.trim() || '';
		const status = searchParams.get('status')?.trim() || '';
		const vendorId = searchParams.get('vendorId')?.trim() || '';
		const labIdParam = searchParams.get('labId')?.trim() || '';
		const insuranceCompanyId = searchParams.get('insuranceCompanyId')?.trim() || '';
		const dateFrom = searchParams.get('dateFrom');
		const dateTo = searchParams.get('dateTo');

		// Base where: only active
		const where: any = { isActive: 1 };

		// Lab scoping
		if (sessionLabId) {
			where.labId = sessionLabId;
		} else if (labIdParam && labIdParam !== 'All Labs') {
			where.labId = labIdParam;
		}

		// Status and direct ids
		if (status) where.status = status;
		if (vendorId) where.vendorId = vendorId;
		if (insuranceCompanyId) where.insuranceCompanyId = insuranceCompanyId;

		// Date-only range (inclusive end-of-day)
		if (dateFrom || dateTo) {
			const gte = dateFrom ? parseDateOnlyStart(dateFrom) : null;
			const lte = dateTo ? endOfDay(parseDateOnlyStart(dateTo)!) : null;
			if (gte || lte) {
				where.apptAt = {};
				if (gte) where.apptAt.gte = gte;
				if (lte) where.apptAt.lte = lte;
			}
		}

		// Free-text search over client/phone/location + Lab + Vendor + Insurance
		if (q) {
			where.OR = [
				{ clientName: { contains: q, mode: 'insensitive' } },
				{ clientRef: { contains: q, mode: 'insensitive' } },
				{ phone: { contains: q, mode: 'insensitive' } },
				{ location: { contains: q, mode: 'insensitive' } },
				// lab fields
				{ lab: { name: { contains: q, mode: 'insensitive' } } },
				{ lab: { nickName: { contains: q, mode: 'insensitive' } } },
				{ lab: { labCode: { contains: q, mode: 'insensitive' } } },
				// vendor fields
				{ vendor: { tpaName: { contains: q, mode: 'insensitive' } } },
				{ vendor: { nickName: { contains: q, mode: 'insensitive' } } },
				{ vendor: { vendorId: { contains: q, mode: 'insensitive' } } },
				// insurance fields
				{ insuranceCompany: { name: { contains: q, mode: 'insensitive' } } },
				{ insuranceCompany: { nickName: { contains: q, mode: 'insensitive' } } },
				{ insuranceCompany: { code: { contains: q, mode: 'insensitive' } } },
			];
		}

		const rows = await prisma.appointment.findMany({
			where,
			orderBy: { apptAt: 'desc' },
			select: {
				id: true,
				apptAt: true,
				vendorId: true,
				insuranceCompanyId: true,
				labId: true,

				clientName: true,
				clientRef: true,
				gender: true,
				age: true,
				phone: true,

				visitType: true,
				location: true,
				status: true,

				serviceType: true,
				paymentStatus: true,
				extraChargeRs: true,

				// ✅ NEW
				testAmountRs: true,

				paymentDate: true,

				isActive: true,
				createdAt: true,

				// optional client-side labels/search
				lab: { select: { name: true, nickName: true, labCode: true } },
				vendor: { select: { tpaName: true, nickName: true, vendorId: true } },
				insuranceCompany: { select: { name: true, nickName: true, code: true } },

				// tests -> build summary
				tests: {
					select: {
						bloodTest: true,
						urineTest: true,
						ecg: true,
						tmt: true,
						applicationForm: true,
					},
				},
			},
			take: 2000,
		});

		const items = rows.map(r => ({
			id: r.id,
			apptAt: isoOrNull(r.apptAt)!,
			vendorId: r.vendorId,
			insuranceCompanyId: r.insuranceCompanyId,
			labId: r.labId,

			clientName: r.clientName,
			clientRef: r.clientRef,
			gender: r.gender,
			age: r.age,
			phone: r.phone,

			visitType: r.visitType,
			location: r.location,
			status: r.status,

			serviceType: r.serviceType,
			paymentStatus: r.paymentStatus,
			extraChargeRs: r.extraChargeRs,

			// ✅ NEW
			testAmountRs: r.testAmountRs ?? 0,

			paymentDate: isoOrNull(r.paymentDate),

			createdAt: isoOrNull(r.createdAt)!,

			_labels: {
				labName: r.lab?.name ?? null,
				labNick: r.lab?.nickName ?? null,
				labCode: r.lab?.labCode ?? null,
				tpaName: r.vendor?.tpaName ?? null,
				tpaNick: r.vendor?.nickName ?? null,
				tpaCode: r.vendor?.vendorId ?? null,
				insName: r.insuranceCompany?.name ?? null,
				insNick: r.insuranceCompany?.nickName ?? null,
				insCode: r.insuranceCompany?.code ?? null,
			},

			testSummary: buildTestSummary(r.tests || undefined),
		}));

		return NextResponse.json(items);
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}

/**
 * POST /api/appointments
 * Accepts both legacy and new field names; writes to single `status` column.
 * NEW: serviceType, paymentDate (date or ISO), testAmountRs
 */
export async function POST(req: Request) {
	try {
		const session = await auth();
		const sessionLabId = (session as any)?.labId as string | undefined;

		const body = await req.json().catch(() => ({}));

		const {
			apptAt,
			vendorId,
			insuranceVendorId, // legacy
			insuranceCompanyId,
			labId,

			clientName,
			patientName, // legacy
			clientRef,
			gender,
			age,
			phone,

			visitType,
			location,
			status,
			extraChargeRs,
			paymentStatus,

			// NEW
			serviceType,
			paymentDate, // yyyy-mm-dd or ISO

			// ✅ NEW
			testAmountRs,
		} = body;

		if (!apptAt) return NextResponse.json({ error: 'apptAt is required' }, { status: 400 });
		const resolvedVendorId = vendorId || insuranceVendorId || null;
		if (!resolvedVendorId) return NextResponse.json({ error: 'vendorId is required' }, { status: 400 });
		if (!insuranceCompanyId) return NextResponse.json({ error: 'insuranceCompanyId is required' }, { status: 400 });
		if (!visitType) return NextResponse.json({ error: 'visitType is required' }, { status: 400 });
		if (!status) return NextResponse.json({ error: 'status is required' }, { status: 400 });

		// paymentDate can be date-only -> set to local midnight
		let paymentDateDt: Date | null = null;
		if (paymentDate) {
			const d0 = parseDateOnlyStart(paymentDate);
			paymentDateDt = d0 ?? parseISOOrNull(paymentDate);
		}

		const created = await prisma.appointment.create({
			data: {
				apptAt: new Date(apptAt),
				vendorId: resolvedVendorId,
				insuranceCompanyId,
				labId: labId ?? sessionLabId ?? null,

				clientName: (clientName ?? patientName) || null,
				clientRef: clientRef || null,
				gender: gender || null,
				age: typeof age === 'number' ? age : (age ? Number(age) : null),
				phone: phone || null,

				visitType,
				location: location || null,
				status,
				extraChargeRs: typeof extraChargeRs === 'number' ? extraChargeRs : (extraChargeRs ? Number(extraChargeRs) : null),
				paymentStatus: paymentStatus || 'On Account',

				serviceType: serviceType || null,
				paymentDate: paymentDateDt,

				// ✅ NEW
				testAmountRs: toNumberOrNull(testAmountRs),

				isActive: 1,
			},
		});

		return NextResponse.json(created, { status: 201 });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}