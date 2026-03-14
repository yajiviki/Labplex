import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';


function asNum(value: unknown) {
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
}

function normalizeVisitType(v?: string | null) {
	const s = (v || '').toUpperCase().trim();
	if (s === 'CENTER') return 'CENTER';
	if (s === 'HOME') return 'HOME';
	return '';
}

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);

		const labId = searchParams.get('labId') || '';
		const vendorId = searchParams.get('vendorId') || '';
		const staffId = searchParams.get('staffId') || '';
		const visitType = normalizeVisitType(searchParams.get('visitType'));
		const dateFrom = searchParams.get('dateFrom') || '';
		const dateTo = searchParams.get('dateTo') || '';

		const apptWhere: any = {};

		if (labId) apptWhere.labId = labId;
		if (vendorId) apptWhere.vendorId = vendorId;
		if (staffId) apptWhere.assignedToId = staffId;
		if (visitType) apptWhere.visitType = visitType;

		if (dateFrom || dateTo) {
			apptWhere.apptAt = {};
			if (dateFrom) {
				const from = new Date(dateFrom);
				from.setHours(0, 0, 0, 0);
				apptWhere.apptAt.gte = from;
			}
			if (dateTo) {
				const to = new Date(dateTo);
				to.setHours(23, 59, 59, 999);
				apptWhere.apptAt.lte = to;
			}
		}

		const [appointments, pettyCashRows] = await Promise.all([
			prisma.appointment.findMany({
				where: apptWhere,
				include: {
					lab: true,
					vendor: true,
					assignedTo: true,
					travelExpenses: true,
				},
				orderBy: { apptAt: 'desc' },
			}),
			prisma.pettyCashTransaction.findMany({
				where: { isActive: 1 },
			}),
		]);

		const totalReceived = pettyCashRows
			.filter((r) => r.txnType === 'RECEIVE')
			.reduce((sum, r) => sum + asNum(r.amount), 0);

		const totalRepaid = pettyCashRows
			.filter((r) => r.txnType === 'REPAY')
			.reduce((sum, r) => sum + asNum(r.amount), 0);

		const totalPettyCashBalance = totalReceived - totalRepaid;

		const rows = appointments.map((a) => {
			const travel = a.travelExpenses?.[0];

			const travelCost = asNum(travel?.fuelAmount);
			const accommodationCost = asNum(travel?.accommodationAmount);
			const totalSpent = asNum(travel?.totalSpent) || travelCost + accommodationCost;
			const tpaForecastAmount = asNum(a.extraChargeRs);
			const profitLossAmount = tpaForecastAmount - totalSpent;

			return {
				id: travel?.id || a.id,
				appointmentId: a.id,
				staffId: a.assignedToId || '',
				staffName: a.assignedTo?.name || '',
				staffUserId: a.assignedTo?.userId || '',
				patientName: a.clientName || '',
				vendorId: a.vendorId || '',
				vendorName: a.vendor?.nickName || a.vendor?.tpaName || '',
				labId: a.labId || '',
				labName: a.lab?.nickName || a.lab?.name || '',
				appointmentDate: a.apptAt,
				visitType: a.visitType || '',
				location: a.location || '',
				status: a.status || '',
				travelCost,
				accommodationCost,
				totalSpent,
				tpaForecastAmount,
				profitLossAmount,
				profitLossStatus:
					profitLossAmount > 0 ? 'Profit' : profitLossAmount < 0 ? 'Loss' : 'Break-even',
				remarks: travel?.notes || '',
				createdAt: travel?.createdAt || null,
				updatedAt: travel?.updatedAt || null,
			};
		});

		const totalSpent = rows.reduce((sum, r) => sum + asNum(r.totalSpent), 0);
		const totalForecast = rows.reduce((sum, r) => sum + asNum(r.tpaForecastAmount), 0);

		const staffMap = new Map<string, { id: string; name: string; userId?: string | null }>();
		for (const a of appointments) {
			if (a.assignedTo?.id) {
				staffMap.set(a.assignedTo.id, {
					id: a.assignedTo.id,
					name: a.assignedTo.name || '',
					userId: a.assignedTo.userId || '',
				});
			}
		}

		const staffOptions = Array.from(staffMap.values()).sort((a, b) =>
			(a.name || '').localeCompare(b.name || '')
		);

		return NextResponse.json({
			ok: true,
			rows,
			staffOptions,
			summary: {
				totalTransactions: rows.length,
				totalPettyCash: totalPettyCashBalance,
				totalSpent,
				totalForecast,
				pendingPettyCash: totalPettyCashBalance - totalSpent,
				netProfitLoss: totalForecast - totalSpent,
			},
		});
	} catch (error: any) {
		console.error('GET /api/travel-settlements error:', error);
		return NextResponse.json(
			{
				ok: false,
				error: error?.message || 'Failed to load travel settlements',
			},
			{ status: 500 }
		);
	}
}