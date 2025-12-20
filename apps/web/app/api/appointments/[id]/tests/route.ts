import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';


function ynToBool(v: unknown): boolean {
	if (typeof v === 'boolean') return v;
	if (typeof v === 'string') {
		const s = v.trim().toLowerCase();
		if (s === 'yes' || s === 'true' || s === '1') return true;
		if (s === 'no' || s === 'false' || s === '0') return false;
	}
	return false;
}

function normalizeBloodTest(v: unknown): 'No' | 'FB' | 'B' {
	if (typeof v !== 'string') return 'No';
	const s = v.trim().toUpperCase();
	if (s === 'FB') return 'FB';
	if (s === 'B') return 'B';
	return 'No';
}

function normalizeAppForm(v: unknown): 'MER' | 'FMR' | 'ALL' | null {
	if (v == null) return null;
	if (typeof v !== 'string') return null;
	const s = v.trim().toUpperCase();
	if (s === 'MER') return 'MER';
	if (s === 'FMR') return 'FMR';
	if (s === 'ALL') return 'ALL';
	return null;
}

function buildSummary(input: {
	bloodTest: 'No' | 'FB' | 'B';
	urineTest: boolean;
	ecg: boolean;
	tmt: boolean;
	applicationForm: 'MER' | 'FMR' | 'ALL' | null;
}) {
	const parts: string[] = [];
	if (input.bloodTest !== 'No') parts.push(input.bloodTest);
	if (input.urineTest) parts.push('U');
	if (input.ecg) parts.push('ECG');
	if (input.tmt) parts.push('TMT');
	if (input.applicationForm) parts.push(input.applicationForm);
	return parts.join(',');
}

export async function PUT(
	req: Request,
	{ params }: { params: { id: string } }
) {
	try {
		const body = await req.json().catch(() => ({}));

		// Ensure appointment exists (and active)
		const appt = await prisma.appointment.findFirst({
			where: { id: params.id, isActive: 1 },
			select: { id: true },
		});
		if (!appt) {
			return NextResponse.json({ error: 'Appointment not found' }, { status: 404 });
		}

		const bloodTest = normalizeBloodTest(body?.bloodTest);
		const urineTest = ynToBool(body?.urineTest);
		const ecg = ynToBool(body?.ecg);
		const tmt = ynToBool(body?.tmt);
		const applicationForm = normalizeAppForm(body?.applicationForm);

		// Save to AppointmentTests table (NOT Appointment)
		const saved = await prisma.appointmentTests.upsert({
			where: { appointmentId: params.id },
			create: {
				appointmentId: params.id,
				bloodTest,
				urineTest,
				ecg,
				tmt,
				applicationForm,
			},
			update: {
				bloodTest,
				urineTest,
				ecg,
				tmt,
				applicationForm,
			},
			select: {
				appointmentId: true,
				bloodTest: true,
				urineTest: true,
				ecg: true,
				tmt: true,
				applicationForm: true,
			},
		});

		// Return a computed summary (no DB column needed)
		const testSummary = buildSummary({
			bloodTest: saved.bloodTest,
			urineTest: saved.urineTest,
			ecg: saved.ecg,
			tmt: saved.tmt,
			applicationForm: saved.applicationForm,
		});

		return NextResponse.json({ ...saved, testSummary }, { status: 200 });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}

export async function GET(
	_req: Request,
	{ params }: { params: { id: string } }
) {
	try {
		const t = await prisma.appointmentTests.findUnique({
			where: { appointmentId: params.id },
			select: {
				appointmentId: true,
				bloodTest: true,
				urineTest: true,
				ecg: true,
				tmt: true,
				applicationForm: true,
			},
		});

		if (!t) return NextResponse.json(null, { status: 200 });

		const testSummary = buildSummary({
			bloodTest: t.bloodTest,
			urineTest: t.urineTest,
			ecg: t.ecg,
			tmt: t.tmt,
			applicationForm: t.applicationForm,
		});

		return NextResponse.json({ ...t, testSummary }, { status: 200 });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
