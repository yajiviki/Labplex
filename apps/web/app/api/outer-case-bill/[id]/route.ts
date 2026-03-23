import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';

type Params = {
	params: {
		id: string;
	};
};

function normalizePaymentStatus(value: unknown): 'PAID' | 'UNPAID' {
	const raw = String(value || '').trim().toLowerCase();

	if (
		raw === 'paid' ||
		raw === 'pay' ||
		raw === 'onaccount' ||
		raw === 'on account'
	) {
		return 'UNPAID';
	}

	if (
		raw === 'not paid' ||
		raw === 'unpaid' ||
		raw === 'not_paid'
	) {
		return 'UNPAID';
	}

	return 'UNPAID';
}

export async function PATCH(req: NextRequest, { params }: Params) {
	try {
		const id = params.id?.trim();

		if (!id) {
			return NextResponse.json(
				{ success: false, message: 'Appointment id is required' },
				{ status: 400 }
			);
		}

		const body = await req.json();

		const outerPaymentRaw = body?.outerPayment;
		const remarksRaw = body?.remarks;
		const paymentStatusRaw = body?.paymentStatus;

		const parsedOuterPayment =
			outerPaymentRaw === '' || outerPaymentRaw === null || outerPaymentRaw === undefined
				? null
				: Number(outerPaymentRaw);

		if (
			parsedOuterPayment !== null &&
			(Number.isNaN(parsedOuterPayment) || parsedOuterPayment < 0)
		) {
			return NextResponse.json(
				{ success: false, message: 'Outer payment must be a valid positive number' },
				{ status: 400 }
			);
		}

		const paymentStatus = normalizePaymentStatus(paymentStatusRaw);

		const remarks =
			typeof remarksRaw === 'string'
				? remarksRaw.trim()
				: '';

		const updated = await prisma.appointment.update({
			where: { id },
			data: {
				extraChargeRs: parsedOuterPayment,
				addressRemark: remarks || null,
				paymentStatus,
				paymentDate: paymentStatus === 'PAID' ? new Date() : null,
			},
			select: {
				id: true,
				extraChargeRs: true,
				addressRemark: true,
				paymentStatus: true,
			},
		});

		return NextResponse.json({
			success: true,
			row: {
				id: updated.id,
				outerPayment: updated.extraChargeRs ? Number(updated.extraChargeRs) : 0,
				remarks: updated.addressRemark || '',
				paymentStatus:
					String(updated.paymentStatus || '').toUpperCase() === 'PAID'
						? 'Paid'
						: 'Not Paid',
			},
		});
	} catch (error) {
		console.error('PATCH /api/outer-case-bill/[id] error:', error);
		return NextResponse.json(
			{ success: false, message: 'Failed to save outer case bill record' },
			{ status: 500 }
		);
	}
}