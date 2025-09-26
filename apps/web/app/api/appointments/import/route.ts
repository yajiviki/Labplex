import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

type InRow = {
	apptAt?: string | null;            // 'YYYY-MM-DD HH:mm:ss' or ISO
	typeOfVisit?: 'CENTER' | 'HOME' | string | null;
	tpaName?: string | null;           // Vendor.tpaName
	insuranceName?: string | null;     // InsuranceCompany.name (under that TPA)
	labName?: string | null;           // Lab.name or Lab.labCode
	clientName?: string | null;
	clientRef?: string | null;
	gender?: string | null;            // 'Male' | 'Female' | null
	age?: number | null;
	address?: string | null;
	location?: string | null;
	phone?: string | null;
	status?: string | null;            // your single “Status” field
	extraChargeRs?: number | null;
	paymentStatus?: string | null;     // 'Paid' | 'On Account' | 'TBI'
};

type InBody = {
	createMissing?: boolean;  // if true, create Vendor/Lab/Insurance if not found
	rows: InRow[];
};

function parseDateLoose(s?: string | null): Date | null {
	if (!s) return null;
	const try1 = new Date(s);
	if (!Number.isNaN(try1.getTime())) return try1;
	// accept 'YYYY-MM-DD HH:mm:ss'
	const fixed = s.replace(' ', 'T');
	const try2 = new Date(fixed);
	return Number.isNaN(try2.getTime()) ? null : try2;
}

export async function POST(req: NextRequest) {
	// ---- auth: NextAuth session OR x-api-key ----
	const session = await auth();
	const apiKey = req.headers.get('x-api-key') || req.nextUrl.searchParams.get('key');
	if (!session && apiKey !== process.env.IMPORT_API_KEY) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = (await req.json()) as InBody;
		if (!body || !Array.isArray(body.rows)) {
			return NextResponse.json({ error: 'Invalid body: { rows: [...] } required' }, { status: 400 });
		}
		const createMissing = Boolean(body.createMissing);

		let inserted = 0;
		let updated = 0;
		let skipped = 0;

		for (const r of body.rows) {
			// resolve Vendor (TPA)
			let vendorId: string | null = null;
			if (r.tpaName) {
				const v = await prisma.vendor.findFirst({
					where: { tpaName: r.tpaName.trim(), isActive: 1 },
					select: { id: true },
				});
				if (v) vendorId = v.id;
				else if (createMissing) {
					const createdV = await prisma.vendor.create({
						data: {
							vendorId: 'TPA' + Math.random().toString().slice(2, 6), // lightweight fallback id
							tpaName: r.tpaName.trim(),
							phone: '',
							isActive: 1,
						},
						select: { id: true },
					});
					vendorId = createdV.id;
				}
			}

			// resolve Lab
			let labId: string | null = null;
			if (r.labName) {
				const l = await prisma.lab.findFirst({
					where: {
						OR: [{ name: r.labName.trim() }, { labCode: r.labName.trim() }],
						isActive: 1,
					},
					select: { id: true },
				});
				if (l) labId = l.id;
				else if (createMissing) {
					const createdL = await prisma.lab.create({
						data: { name: r.labName.trim(), labCode: r.labName.trim(), isActive: 1 },
						select: { id: true },
					});
					labId = createdL.id;
				}
			}

			// resolve Insurance under that Vendor
			let insuranceCompanyId: string | null = null;
			if (r.insuranceName && vendorId) {
				const ic = await prisma.insuranceCompany.findFirst({
					where: { vendorId, name: r.insuranceName.trim(), isActive: 1 },
					select: { id: true },
				});
				if (ic) insuranceCompanyId = ic.id;
				else if (createMissing) {
					const createdIC = await prisma.insuranceCompany.create({
						data: { vendorId, name: r.insuranceName.trim(), isActive: 1 },
						select: { id: true },
					});
					insuranceCompanyId = createdIC.id;
				}
			}

			const when = parseDateLoose(r.apptAt);
			if (!when) { skipped++; continue; }

			// Upsert heuristic: same datetime + clientRef (or phone) = same appt
			const existing = await prisma.appointment.findFirst({
				where: {
					apptAt: when,
					OR: [
						r.clientRef ? { clientRef: r.clientRef } : { clientRef: null },
						r.phone ? { phone: r.phone } : { phone: null },
					],
				},
				select: { id: true },
			});

			const data = {
				apptAt: when,
				visitType: r.typeOfVisit || null,
				vendorId,
				insuranceCompanyId,
				labId,
				clientName: r.clientName || null,
				clientRef: r.clientRef || null,
				gender: r.gender || null,
				age: r.age ?? null,
				address: r.address || null,
				location: r.location || null,
				phone: r.phone || null,
				medicalStatus: r.status || null,    // single “Status” field
				extraChargeRs: r.extraChargeRs ?? null,
				paymentStatus: r.paymentStatus || null,
				isActive: 1 as const,
			};

			if (existing) {
				await prisma.appointment.update({ where: { id: existing.id }, data });
				updated++;
			} else {
				await prisma.appointment.create({ data });
				inserted++;
			}
		}

		return NextResponse.json({ inserted, updated, skipped });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Import error' }, { status: 500 });
	}
}
