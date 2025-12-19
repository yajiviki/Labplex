// /app/api/appointments/today/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';


export async function GET() {
	const today = new Date();
	const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
	const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

	const list = await prisma.appointment.findMany({
		where: { isActive: 1, apptAt: { gte: start, lt: end } },
		select: { id: true, clientName: true, apptAt: true, bloodTest: true, urineTest: true, ecg: true, applicationForm: true },
		orderBy: { apptAt: 'asc' },
	});

	return NextResponse.json({
		count: list.length,
		items: list,
	});
}
