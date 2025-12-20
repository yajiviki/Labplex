// /app/api/appointments/today/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';

function startOfToday() {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	return d;
}
function endOfToday() {
	const d = new Date();
	d.setHours(23, 59, 59, 999);
	return d;
}

export async function GET() {
	try {
		const start = startOfToday();
		const end = endOfToday();

		const list = await prisma.appointment.findMany({
			where: { isActive: 1, apptAt: { gte: start, lt: end } },
			select: {
				id: true,
				clientName: true,
				apptAt: true,
				// IMPORTANT: test fields are on the related row
				tests: {
					select: {
						bloodTest: true,        // 'FB' | 'R' | null
						urineTest: true,        // boolean | 'Yes' | 'No' | null
						ecg: true,              // boolean | 'Yes' | 'No' | null
						applicationForm: true,  // 'MER' | 'FMR' | null
					},
				},
			},
			orderBy: { apptAt: 'asc' },
		});

		const items = list.map(a => {
			const t = a.tests;
			const parts: string[] = [];

			if (t?.bloodTest) parts.push(String(t.bloodTest).toUpperCase());
			if (t?.urineTest === true || String(t?.urineTest).toLowerCase() === 'yes') parts.push('U');
			if (t?.ecg === true || String(t?.ecg).toLowerCase() === 'yes') parts.push('ECG');
			if (t?.applicationForm) parts.push(String(t.applicationForm).toUpperCase());

			return {
				id: a.id,
				clientName: a.clientName,
				apptAt: a.apptAt,
				test: parts.join(','), // e.g. "FB,U,ECG,MER"
			};
		});

		return NextResponse.json({ count: items.length, items });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
