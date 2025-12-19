// app/api/appointments/[id]/tests/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';

function asBool(v: any) {
	if (v === true) return true;
	if (v === false) return false;
	if (typeof v === 'string') {
		const s = v.trim().toLowerCase();
		if (s === 'yes' || s === 'true' || s === '1') return true;
		if (s === 'no' || s === 'false' || s === '0' || s === '') return false;
	}
	if (typeof v === 'number') return v !== 0;
	return false;
}
function asBloodTest(v: any): 'FB' | 'B' | 'NONE' {
	const s = (v ?? '').toString().toUpperCase();
	if (s === 'FB') return 'FB';
	if (s === 'B' || s === 'RANDOM') return 'B';
	return 'NONE';
}
function asApplicationForm(v: any): 'MER' | 'FMR' | null {
	const s = (v ?? '').toString().toUpperCase();
	if (s === 'MER') return 'MER';
	if (s === 'FMR') return 'FMR';
	return null;
}

export async function PUT(
	_req: Request,
	{ params }: { params: { id: string } }
) {
	try {
		const body = await _req.json().catch(() => ({}));
		const bloodTest = asBloodTest(body.bloodTest);
		const urineTest = asBool(body.urineTest);
		const ecg = asBool(body.ecg);
		const applicationForm = asApplicationForm(body.applicationForm);

		const saved = await prisma.appointmentTests.upsert({
			where: { appointmentId: params.id },
			update: { bloodTest, urineTest, ecg, applicationForm },
			create: {
				appointmentId: params.id,
				bloodTest,
				urineTest,
				ecg,
				applicationForm,
			},
		});

		return NextResponse.json(saved);
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Save failed' }, { status: 500 });
	}
}
