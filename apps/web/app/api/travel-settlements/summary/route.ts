import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';


function asNum(value: unknown) {
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
}

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);

		const from = searchParams.get('from');
		const to = searchParams.get('to');

		const pettyCashWhere: any = { isActive: 1 };
		const travelWhere: any = {};

		if (from || to) {
			pettyCashWhere.txnDate = {};
			travelWhere.travelDate = {};

			if (from) {
				const fromDate = new Date(from);
				pettyCashWhere.txnDate.gte = fromDate;
				travelWhere.travelDate.gte = fromDate;
			}

			if (to) {
				const toDate = new Date(to);
				toDate.setHours(23, 59, 59, 999);
				pettyCashWhere.txnDate.lte = toDate;
				travelWhere.travelDate.lte = toDate;
			}
		}

		const [pettyRows, travelRows] = await Promise.all([
			prisma.pettyCashTransaction.findMany({
				where: pettyCashWhere,
			}),
			prisma.travelExpense.findMany({
				where: travelWhere,
				include: {
					appointment: true,
				},
				orderBy: [{ travelDate: 'desc' }, { createdAt: 'desc' }],
			}),
		]);

		const totalReceived = pettyRows
			.filter((r) => r.txnType === 'RECEIVE')
			.reduce((sum, r) => sum + asNum(r.amount), 0);

		const totalRepaid = pettyRows
			.filter((r) => r.txnType === 'REPAY')
			.reduce((sum, r) => sum + asNum(r.amount), 0);

		const totalTravelSpend = travelRows.reduce(
			(sum, r) => sum + asNum(r.totalSpent),
			0
		);

		const totalForecastAmount = travelRows.reduce(
			(sum, r) => sum + asNum(r.appointment?.extraChargeRs),
			0
		);

		const availablePettyCash = totalReceived - totalRepaid - totalTravelSpend;
		const netAfterForecast = totalForecastAmount - totalTravelSpend;

		const recentTravelRows = travelRows.map((r) => ({
			id: r.id,
			travelDate: r.travelDate,
			patientName: r.patientName,
			travelFrom: r.travelFrom,
			travelTo: r.travelTo,
			fuelAmount: asNum(r.fuelAmount),
			foodAmount: asNum(r.foodAmount),
			accommodationAmount: asNum(r.accommodationAmount),
			otherAmount: asNum(r.otherAmount),
			totalSpent: asNum(r.totalSpent),
			notes: r.notes,
			appointment: r.appointment
				? {
					id: r.appointment.id,
					clientName: r.appointment.clientName,
					clientRef: r.appointment.clientRef,
					apptAt: r.appointment.apptAt,
					extraChargeRs: asNum(r.appointment.extraChargeRs),
					testAmountRs: asNum(r.appointment.testAmountRs),
					location: r.appointment.location,
					status: r.appointment.status,
				}
				: null,
		}));

		return NextResponse.json({
			success: true,
			summary: {
				totalReceived,
				totalRepaid,
				totalTravelSpend,
				availablePettyCash,
				totalForecastAmount,
				netAfterForecast,
			},
			travelRows: recentTravelRows,
		});
	} catch (error: any) {
		console.error('GET /api/travel-settlement/summary error:', error);

		return NextResponse.json(
			{
				success: false,
				error: error?.message || 'Failed to fetch travel settlement summary',
			},
			{ status: 500 }
		);
	}
}