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
				id: true, patientId: true, name: true, tpaName: true, insuranceName: true,
				doctorName: true, address: true, phone: true, createdAt: true,
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

		const { name, tpaName, insuranceName, doctorName, address, phone } = await req.json().catch(() => ({}));
		if (!name?.trim() || !phone?.trim()) return NextResponse.json({ error: 'Please fill Name and Mobile.' }, { status: 400 });

		// generate next patientId
		const all = await prisma.patient.findMany({ select: { patientId: true } });
		const pid = nextPatientIdFromExisting(all.map(a => a.patientId || ''));

		const created = await prisma.patient.create({
			data: {
				patientId: pid,
				name: name.trim(),
				tpaName: tpaName || null,
				insuranceName: insuranceName || null,
				doctorName: doctorName || null,
				address: address || null,
				phone: phone.trim(),
				isActive: 1,
			},
			select: {
				id: true, patientId: true, name: true, tpaName: true, insuranceName: true,
				doctorName: true, address: true, phone: true, createdAt: true,
			},
		});
		return NextResponse.json(created, { status: 201 });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
