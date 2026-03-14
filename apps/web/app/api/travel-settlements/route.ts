import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';


function asNum(v: unknown): number {
	if (v == null) return 0;
	if (typeof v === 'number') return v;
	if (typeof v === 'string') return Number(v) || 0;
	if (typeof v === 'object' && v && 'toString' in v) return Number((v as any).toString()) || 0;
	return 0;
}

function normalizeVisitType(v?: string | null) {
	const s = (v || '').toUpperCase().trim();
	if (s === 'CENTER') return 'CENTER';
	if (s === 'HOME') return 'HOME';
	return '';
}

function getProfitLossStatus(value: number): 'Profit' | 'Loss' | 'Break-even' {
	if (value > 0) return 'Profit';
	if (value < 0) return 'Loss';
	return 'Break-even';
}

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);

		const labId = (searchParams.get('labId') || '').trim();
		const vendorId = (searchParams.get('vendorId') || '').trim();
		const staffId = (searchParams.get('staffId') || '').trim();
		const visitType = normalizeVisitType(searchParams.get('visitType'));
		const dateFrom = (searchParams.get('dateFrom') || '').trim();
		const dateTo = (searchParams.get('dateTo') || '').trim();

		const apptWhere: any = {
			status: {
				in: ['Need Confirmation', 'Need confirmation', 'Report - Completed', 'Report - InProgress'],
			},
		};

		if (labId) apptWhere.labId = labId;
		if (vendorId) apptWhere.vendorId = vendorId;
		if (staffId) apptWhere.assignedToId = staffId;
		if (visitType) apptWhere.visitType = visitType;

		if (dateFrom || dateTo) {
			apptWhere.apptAt = {};
			if (dateFrom) apptWhere.apptAt.gte = new Date(`${dateFrom}T00:00:00`);
			if (dateTo) apptWhere.apptAt.lte = new Date(`${dateTo}T23:59:59.999`);
		}

		const [appointments, pettyCashRows] = await Promise.all([
			prisma.appointment.findMany({
				where: apptWhere,
				orderBy: [{ apptAt: 'desc' }, { clientName: 'asc' as any }],
				select: {
					id: true,
					labId: true as any,
					vendorId: true as any,
					assignedToId: true as any,
					apptAt: true as any,
					clientName: true as any,
					location: true as any,
					status: true as any,
					visitType: true as any,
					extraChargeRs: true as any,
					lab: {
						select: {
							id: true,
							name: true,
							nickName: true as any,
							labCode: true as any,
						},
					} as any,
					vendor: {
						select: {
							id: true,
							tpaName: true as any,
							nickName: true as any,
							vendorId: true as any,
						},
					} as any,
					assignedTo: {
						select: {
							id: true,
							name: true,
							userId: true as any,
						},
					} as any,
				},
			}),
			prisma.pettyCashEntry.findMany({
				orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
			}),
		]);

		const appointmentIds = appointments.map((a: any) => a.id);

		const settlementRows = appointmentIds.length
			? await prisma.travelSettlement.findMany({
				where: {
					appointmentId: { in: appointmentIds },
				},
			})
			: [];

		const settlementMap = new Map<string, any>();
		for (const s of settlementRows) settlementMap.set(s.appointmentId, s);

		const rows = appointments.map((a: any) => {
			const existing = settlementMap.get(a.id);
			const travelCost = existing ? asNum(existing.travelCost) : 0;
			const accommodationCost = existing ? asNum(existing.accommodationCost) : 0;
			const totalSpent = travelCost + accommodationCost;
			const tpaForecastAmount = existing
				? asNum(existing.tpaForecastAmount)
				: asNum(a.extraChargeRs);
			const profitLossAmount = tpaForecastAmount - totalSpent;

			return {
				id: existing?.id ?? '',
				appointmentId: a.id,
				staffId: a.assignedToId ?? '',
				staffName: a.assignedTo?.name || '',
				staffUserId: a.assignedTo?.userId || '',
				patientName: a.clientName ?? '',
				vendorId: a.vendorId ?? '',
				vendorName: a.vendor?.nickName || a.vendor?.tpaName || a.vendor?.vendorId || '',
				labId: a.labId ?? '',
				labName: a.lab?.nickName || a.lab?.name || a.lab?.labCode || '',
				appointmentDate: a.apptAt,
				visitType: a.visitType ?? '',
				location: a.location ?? '',
				status: a.status ?? '',
				travelCost,
				accommodationCost,
				totalSpent,
				tpaForecastAmount,
				profitLossAmount,
				profitLossStatus: existing?.profitLossStatus ?? getProfitLossStatus(profitLossAmount),
				remarks: existing?.remarks ?? '',
				createdAt: existing?.createdAt ?? null,
				updatedAt: existing?.updatedAt ?? null,
			};
		});

		const staffOptions = Array.from(
			new Map(
				rows
					.filter((r) => r.staffId)
					.map((r) => [
						r.staffId,
						{
							id: r.staffId,
							name: r.staffName || '',
							userId: r.staffUserId || '',
						},
					])
			).values()
		).sort((a, b) => {
			const al = `${a.name}${a.userId ? ` (${a.userId})` : ''}`.toLowerCase();
			const bl = `${b.name}${b.userId ? ` (${b.userId})` : ''}`.toLowerCase();
			return al.localeCompare(bl);
		});

		const totalPettyCash = pettyCashRows.reduce((sum: number, r: any) => sum + asNum(r.amount), 0);
		const totalSpent = rows.reduce((sum: number, r: any) => sum + asNum(r.totalSpent), 0);
		const totalForecast = rows.reduce((sum: number, r: any) => sum + asNum(r.tpaForecastAmount), 0);
		const pendingPettyCash = totalPettyCash - totalSpent;
		const netProfitLoss = totalForecast - totalSpent;

		return NextResponse.json({
			ok: true,
			rows,
			staffOptions,
			pettyCashRows: pettyCashRows.map((r: any) => ({
				id: r.id,
				entryDate: r.entryDate,
				amount: asNum(r.amount),
				description: r.description ?? '',
				createdAt: r.createdAt,
				updatedAt: r.updatedAt,
			})),
			summary: {
				totalTransactions: rows.length,
				totalPettyCash,
				totalSpent,
				totalForecast,
				pendingPettyCash,
				netProfitLoss,
			},
		});
	} catch (error: any) {
		console.error('GET /api/travel-settlements error:', error);
		return NextResponse.json(
			{ ok: false, error: error?.message || 'Failed to load travel settlements' },
			{ status: 500 }
		);
	}
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const items = Array.isArray(body?.items) ? body.items : [];

		if (!items.length) {
			return NextResponse.json({ ok: false, error: 'No items provided' }, { status: 400 });
		}

		const appointmentIds = items
			.map((x: any) => String(x.appointmentId || '').trim())
			.filter(Boolean);

		if (!appointmentIds.length) {
			return NextResponse.json({ ok: false, error: 'Invalid appointment ids' }, { status: 400 });
		}

		const appointments = await prisma.appointment.findMany({
			where: {
				id: { in: appointmentIds },
			},
			select: {
				id: true,
				clientName: true as any,
				labId: true as any,
				vendorId: true as any,
				apptAt: true as any,
				visitType: true as any,
				location: true as any,
				extraChargeRs: true as any,
				assignedToId: true as any,
			},
		});

		const apptMap = new Map<string, any>();
		for (const a of appointments) apptMap.set(a.id, a);

		for (const item of items) {
			const appointmentId = String(item.appointmentId || '').trim();
			if (!appointmentId || !apptMap.has(appointmentId)) {
				return NextResponse.json(
					{ ok: false, error: `Appointment not found: ${appointmentId}` },
					{ status: 404 }
				);
			}
		}

		await prisma.$transaction(
			items.map((item: any) => {
				const appointmentId = String(item.appointmentId || '').trim();
				const appt = apptMap.get(appointmentId);

				const staffId = appt.assignedToId ? String(appt.assignedToId).trim() : null;
				const travelCost = asNum(item.travelCost);
				const accommodationCost = asNum(item.accommodationCost);
				const remarks = String(item.remarks || '').trim() || null;

				const totalSpent = travelCost + accommodationCost;
				const tpaForecastAmount = asNum(appt.extraChargeRs);
				const profitLossAmount = tpaForecastAmount - totalSpent;
				const profitLossStatus = getProfitLossStatus(profitLossAmount);

				return prisma.travelSettlement.upsert({
					where: {
						appointmentId,
					},
					update: {
						staffId,
						patientName: appt.clientName ?? '',
						vendorId: appt.vendorId ?? null,
						labId: appt.labId ?? null,
						appointmentDate: appt.apptAt ?? null,
						visitType: appt.visitType ?? null,
						location: appt.location ?? null,
						travelCost,
						accommodationCost,
						totalSpent,
						tpaForecastAmount,
						profitLossAmount,
						profitLossStatus,
						remarks,
					},
					create: {
						appointmentId,
						staffId,
						patientName: appt.clientName ?? '',
						vendorId: appt.vendorId ?? null,
						labId: appt.labId ?? null,
						appointmentDate: appt.apptAt ?? null,
						visitType: appt.visitType ?? null,
						location: appt.location ?? null,
						travelCost,
						accommodationCost,
						totalSpent,
						tpaForecastAmount,
						profitLossAmount,
						profitLossStatus,
						remarks,
					},
				});
			})
		);

		return NextResponse.json({ ok: true });
	} catch (error: any) {
		console.error('POST /api/travel-settlements error:', error);
		return NextResponse.json(
			{ ok: false, error: error?.message || 'Failed to save travel settlements' },
			{ status: 500 }
		);
	}
}