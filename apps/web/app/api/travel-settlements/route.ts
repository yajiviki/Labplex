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

function getSettlementStatus(balance: number): 'Balance to return' | 'Settled' | 'Extra claim' {
	if (balance > 0) return 'Balance to return';
	if (balance < 0) return 'Extra claim';
	return 'Settled';
}

function getProfitLossStatus(value: number): 'Profit' | 'Loss' | 'Break-even' {
	if (value > 0) return 'Profit';
	if (value < 0) return 'Loss';
	return 'Break-even';
}

function serializeRow(row: any) {
	return {
		id: row.id,
		appointmentId: row.appointmentId,
		staffId: row.staffId ?? '',
		patientName: row.patientName ?? '',
		vendorId: row.vendorId ?? '',
		labId: row.labId ?? '',
		appointmentDate: row.appointmentDate,
		visitType: row.visitType ?? '',
		location: row.location ?? '',
		pettyCashGiven: asNum(row.pettyCashGiven),
		travelCost: asNum(row.travelCost),
		accommodationCost: asNum(row.accommodationCost),
		totalSpent: asNum(row.totalSpent),
		tpaReceivedAmount: asNum(row.tpaReceivedAmount),
		pettyCashBalance: asNum(row.pettyCashBalance),
		profitLossAmount: asNum(row.profitLossAmount),
		settlementStatus: row.settlementStatus ?? 'Settled',
		profitLossStatus: row.profitLossStatus ?? 'Break-even',
		remarks: row.remarks ?? '',
		createdBy: row.createdBy ?? '',
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
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
				in: ['Need Confirmation', 'Report completed', 'Report Completed'],
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

		const [appointments, settlements, users] = await Promise.all([
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
					extraRs: true as any,
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
			prisma.travelSettlement.findMany({
				where: {
					appointmentId: {
						in: [],
					},
				},
			}),
			prisma.user.findMany({
				orderBy: [{ name: 'asc' }],
				select: {
					id: true,
					name: true,
					userId: true as any,
					phone: true as any,
					role: true as any,
					labId: true as any,
					lab: {
						select: {
							name: true,
							nickName: true as any,
							labCode: true as any,
						},
					} as any,
				},
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

			return {
				id: existing?.id ?? '',
				appointmentId: a.id,
				staffId: existing?.staffId ?? a.assignedToId ?? '',
				staffName: a.assignedTo?.name || '',
				patientName: a.clientName ?? '',
				vendorId: a.vendorId ?? '',
				vendorName: a.vendor?.nickName || a.vendor?.tpaName || a.vendor?.vendorId || '',
				labId: a.labId ?? '',
				labName: a.lab?.nickName || a.lab?.name || a.lab?.labCode || '',
				appointmentDate: a.apptAt,
				visitType: a.visitType ?? '',
				location: a.location ?? '',
				status: a.status ?? '',
				pettyCashGiven: existing ? asNum(existing.pettyCashGiven) : 0,
				travelCost: existing ? asNum(existing.travelCost) : 0,
				accommodationCost: existing ? asNum(existing.accommodationCost) : 0,
				totalSpent: existing ? asNum(existing.totalSpent) : 0,
				tpaReceivedAmount: existing ? asNum(existing.tpaReceivedAmount) : asNum(a.extraRs),
				pettyCashBalance: existing ? asNum(existing.pettyCashBalance) : 0,
				profitLossAmount: existing ? asNum(existing.profitLossAmount) : asNum(a.extraRs),
				settlementStatus: existing?.settlementStatus ?? 'Settled',
				profitLossStatus: existing?.profitLossStatus ?? (asNum(a.extraRs) > 0 ? 'Profit' : 'Break-even'),
				remarks: existing?.remarks ?? '',
				createdAt: existing?.createdAt ?? null,
				updatedAt: existing?.updatedAt ?? null,
			};
		});

		const summary = rows.reduce(
			(acc, r) => {
				acc.totalRows += 1;
				acc.totalPettyCash += asNum(r.pettyCashGiven);
				acc.totalSpent += asNum(r.totalSpent);
				acc.totalReceived += asNum(r.tpaReceivedAmount);
				acc.totalBalance += asNum(r.pettyCashBalance);
				acc.netProfitLoss += asNum(r.profitLossAmount);
				return acc;
			},
			{
				totalRows: 0,
				totalPettyCash: 0,
				totalSpent: 0,
				totalReceived: 0,
				totalBalance: 0,
				netProfitLoss: 0,
			}
		);

		return NextResponse.json({
			ok: true,
			rows,
			users,
			summary,
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
				extraRs: true as any,
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

				const staffId = String(item.staffId || appt.assignedToId || '').trim() || null;
				const pettyCashGiven = asNum(item.pettyCashGiven);
				const travelCost = asNum(item.travelCost);
				const accommodationCost = asNum(item.accommodationCost);
				const remarks = String(item.remarks || '').trim() || null;

				const totalSpent = travelCost + accommodationCost;
				const tpaReceivedAmount = asNum(appt.extraRs);
				const pettyCashBalance = pettyCashGiven - totalSpent;
				const profitLossAmount = tpaReceivedAmount - totalSpent;

				const settlementStatus = getSettlementStatus(pettyCashBalance);
				const profitLossStatus = getProfitLossStatus(profitLossAmount);

				return prisma.travelSettlement.upsert({
					where: {
						appointmentId,
					} as any,
					update: {
						staffId,
						patientName: appt.clientName ?? '',
						vendorId: appt.vendorId ?? null,
						labId: appt.labId ?? null,
						appointmentDate: appt.apptAt ?? null,
						visitType: appt.visitType ?? null,
						location: appt.location ?? null,
						pettyCashGiven,
						travelCost,
						accommodationCost,
						totalSpent,
						tpaReceivedAmount,
						pettyCashBalance,
						profitLossAmount,
						settlementStatus,
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
						pettyCashGiven,
						travelCost,
						accommodationCost,
						totalSpent,
						tpaReceivedAmount,
						pettyCashBalance,
						profitLossAmount,
						settlementStatus,
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