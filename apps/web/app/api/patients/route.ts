import { NextResponse } from 'next/server';
import { auth } from '../../../lib/auth';
import { prisma } from '../../../lib/db';


function nextPatientIdFromExisting(ids: string[]) {
	const prefix = 'OP';
	let max = 0;
	for (const id of ids) {
		if (id?.startsWith(prefix)) {
			const n = parseInt(id.slice(prefix.length), 10);
			if (!isNaN(n) && n > max) max = n;
		}
	}
	return `${prefix}${String(max + 1).padStart(4, '0')}`;
}

export async function GET() {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const items = await prisma.patient.findMany({
			where: { isActive: 1 },
			orderBy: { createdAt: 'desc' },
			select: {
				id: true, patientId: true, name: true,
				address: true, phone: true, doctorName: true,
				// canonical relations (preferred in UI)
				vendorId: true, insuranceCompanyId: true,
				vendor: { select: { id: true, tpaName: true, vendorId: true } },
				insuranceCompany: { select: { id: true, name: true } },
				// legacy display if you need it
				tpaName: true, insuranceName: true,
				createdAt: true,
			},
		});
		return NextResponse.json(items);
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}

export async function POST(req: Request) {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const body = await req.json().catch(() => ({}));
		const { name, address, phone, doctorName, vendorId, insuranceCompanyId } = body;

		const normalizedPhone = (phone || '').toString().replace(/\D+/g, '');
		if (!name?.trim() || !normalizedPhone) {
			return NextResponse.json({ error: 'Please fill Name and Mobile.' }, { status: 400 });
		}

		// create next PatientId
		const all = await prisma.patient.findMany({ select: { patientId: true } });
		const pid = nextPatientIdFromExisting(all.map(a => a.patientId || ''));

		const created = await prisma.patient.create({
			data: {
				patientId: pid,
				name: name.trim(),
				address: address || null,
				phone: normalizedPhone,
				doctorName: doctorName || null,
				vendorId: vendorId || null,
				insuranceCompanyId: insuranceCompanyId || null,
				isActive: 1,
			},
			select: {
				id: true, patientId: true, name: true, address: true, phone: true, doctorName: true,
				vendorId: true, insuranceCompanyId: true,
				vendor: { select: { id: true, tpaName: true, vendorId: true } },
				insuranceCompany: { select: { id: true, name: true } },
				createdAt: true,
			},
		});
		return NextResponse.json(created, { status: 201 });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
