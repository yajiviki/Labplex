import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../lib/db';

function toStartOfDay(dateStr: string) {
	return new Date(`${dateStr}T00:00:00.000Z`);
}

function toEndOfDay(dateStr: string) {
	return new Date(`${dateStr}T23:59:59.999Z`);
}

function isPaidStatus(value: unknown) {
	const status = String(value || '').trim().toUpperCase();
	return ['PAID', 'ONACCOUNT', 'ON ACCOUNT'].includes(status);
}

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);

		const labId = searchParams.get('labId')?.trim() || '';
		const vendorId = searchParams.get('vendorId')?.trim() || '';
		const location = searchParams.get('location')?.trim() || '';
		const paymentStatus = searchParams.get('paymentStatus')?.trim() || '';
		const from = searchParams.get('from')?.trim() || '';
		const to = searchParams.get('to')?.trim() || '';

		const andConditions: Prisma.AppointmentWhereInput[] = [
			{
				OR: [
					{ status: { equals: 'Report - InProgress', mode: 'insensitive' } },
					{ status: { equals: 'Report - Completed', mode: 'insensitive' } },
				],
			},
		];

		if (location) {
			andConditions.push({
				location: {
					equals: location,
					mode: 'insensitive',
				},
			});
		}

		if (paymentStatus) {
			const normalized = paymentStatus.toLowerCase();

			if (normalized === 'paid') {
				andConditions.push({
					OR: [
						{ paymentStatus: { equals: 'PAID', mode: 'insensitive' } },
						{ paymentStatus: { equals: 'OnAccount', mode: 'insensitive' } },
						{ paymentStatus: { equals: 'ONACCOUNT', mode: 'insensitive' } },
						{ paymentStatus: { equals: 'ON ACCOUNT', mode: 'insensitive' } },
					],
				});
			}

			if (normalized === 'not paid') {
				andConditions.push({
					OR: [
						{ paymentStatus: { equals: 'UNPAID', mode: 'insensitive' } },
						{ paymentStatus: { equals: 'Not Paid', mode: 'insensitive' } },
						{ paymentStatus: null },
					],
				});
			}
		}

		const where: Prisma.AppointmentWhereInput = {
			isActive: 1,
			serviceType: {
				equals: 'Outer',
				mode: 'insensitive',
			},
			AND: andConditions,
		};

		if (labId) where.labId = labId;
		if (vendorId) where.vendorId = vendorId;

		if (from || to) {
			where.apptAt = {};
			if (from) where.apptAt.gte = toStartOfDay(from);
			if (to) where.apptAt.lte = toEndOfDay(to);
		}

		const rows = await prisma.appointment.findMany({
			where,
			select: {
				id: true,
				apptAt: true,
				clientName: true,
				status: true,
				location: true,
				extraChargeRs: true,
				addressRemark: true,
				paymentStatus: true,
				labId: true,
				vendorId: true,
				lab: {
					select: {
						id: true,
						name: true,
						nickName: true,
						labCode: true,
					},
				},
				vendor: {
					select: {
						id: true,
						tpaName: true,
						nickName: true,
						vendorId: true,
					},
				},
			},
			orderBy: [{ apptAt: 'desc' }, { updatedAt: 'desc' }],
		});

		return NextResponse.json({
			success: true,
			rows: rows.map((r) => ({
				id: r.id,
				appointmentDate: r.apptAt,
				labId: r.labId || '',
				vendorId: r.vendorId || '',
				lab: r.lab ? r.lab.nickName || r.lab.name || r.lab.labCode || '' : '',
				tpa: r.vendor ? r.vendor.tpaName || r.vendor.nickName || r.vendor.vendorId || '' : '',
				client: r.clientName || '',
				status: r.status || '',
				outerPayment: r.extraChargeRs ? Number(r.extraChargeRs) : 0,
				location: r.location || '',
				remarks: r.addressRemark || '',
				paymentStatus: isPaidStatus(r.paymentStatus) ? 'Paid' : 'Not Paid',
			})),
		});
	} catch (error) {
		console.error('GET /api/outer-case-bill error:', error);
		return NextResponse.json(
			{ success: false, message: 'Failed to fetch outer case bill records' },
			{ status: 500 }
		);
	}
}