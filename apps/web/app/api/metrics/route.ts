// apps/web/app/api/metrics/route.ts
import { NextResponse } from 'next/server';
import { auth } from '../../../lib/auth';
import { getAppointmentCounts } from '../../../lib/appointmentCounts';

export async function GET() {
	try {
		const session = await auth();
		// For lab-scoped dashboards, pass session.labId.
		// For super-admin global view, pass undefined.
		const labId = (session as any)?.labId as string | undefined;

		const kpis = await getAppointmentCounts(labId);
		return NextResponse.json(kpis);
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
