// app/api/appointments/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

function parseDateOnlyStart(v?: string | null) {
	if (!v) return null;
	const a = v.match(/^(\d{4})[-/](\d{2})[-/](\d{2})$/);
	if (a) return new Date(+a[1], +a[2] - 1, +a[3], 0, 0, 0, 0);
	const b = v.match(/^(\d{2})-(\d{2})-(\d{4})$/);
	if (b) return new Date(+b[3], +b[2] - 1, +b[1], 0, 0, 0, 0);
	const d = new Date(v);
	return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
function parseISOOrNull(v?: string | null) {
	if (!v) return null;
	const d = new Date(v);
	return Number.isNaN(d.getTime()) ? null : d;
}
function toNumberOrNull(v: any): number | null {
	if (v === null || v === undefined || v === '') return null;
	const n = typeof v === 'number' ? v : Number(v);
	return Number.isFinite(n) ? n : null;
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
	try {
		const session = await auth();
		const sessionLabId = (session as any)?.labId as string | undefined;

		const id = params.id;
		if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

		const body = await req.json().catch(() => ({}));

		// Scope by lab if session has labId
		const existing = await prisma.appointment.findFirst({
			where: { id, ...(sessionLabId ? { labId: sessionLabId } : {}), isActive: 1 },
		});
		if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

		const resolvedVendorId = body.vendorId || body.insuranceVendorId || existing.vendorId;

		// Handle paymentDate which might be date-only or ISO
		let newPaymentDate: Date | null | undefined = undefined;
		if ('paymentDate' in body) {
			if (body.paymentDate === null || body.paymentDate === '') newPaymentDate = null;
			else newPaymentDate = parseDateOnlyStart(body.paymentDate) ?? parseISOOrNull(body.paymentDate);
		}

		// ✅ Handle testAmountRs (allow clearing)
		let newTestAmount: number | null | undefined = undefined;
		if ('testAmountRs' in body) {
			newTestAmount = toNumberOrNull(body.testAmountRs);
		}

		const updated = await prisma.appointment.update({
			where: { id },
			data: {
				apptAt: body.apptAt ? new Date(body.apptAt) : existing.apptAt,

				vendorId: resolvedVendorId ?? existing.vendorId,
				insuranceCompanyId: body.insuranceCompanyId ?? existing.insuranceCompanyId,
				labId: (body.labId ?? (sessionLabId || existing.labId)),

				clientName: (body.clientName ?? body.patientName ?? existing.clientName),
				clientRef: body.clientRef ?? existing.clientRef,
				gender: body.gender ?? existing.gender,
				age:
					body.age !== undefined
						? (body.age === null || body.age === '' ? null : Number(body.age))
						: existing.age,
				phone: body.phone ?? existing.phone,

				visitType: body.visitType ?? existing.visitType,
				location: body.location ?? existing.location,
				status: body.status ?? existing.status,
				extraChargeRs:
					body.extraChargeRs !== undefined
						? (body.extraChargeRs === null || body.extraChargeRs === '' ? null : Number(body.extraChargeRs))
						: existing.extraChargeRs,
				paymentStatus: body.paymentStatus ?? existing.paymentStatus,

				serviceType: body.serviceType ?? existing.serviceType,
				paymentDate: newPaymentDate !== undefined ? newPaymentDate : existing.paymentDate,

				// ✅ NEW
				testAmountRs: newTestAmount !== undefined ? newTestAmount : existing.testAmountRs,
			},
		});

		return NextResponse.json(updated);
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
	try {
		const session = await auth();
		const sessionLabId = (session as any)?.labId as string | undefined;

		const existing = await prisma.appointment.findFirst({
			where: { id: params.id, ...(sessionLabId ? { labId: sessionLabId } : {}), isActive: 1 },
			select: { id: true },
		});
		if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

		await prisma.appointment.update({
			where: { id: params.id },
			data: { isActive: 0 },
		});

		return NextResponse.json({ ok: true });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}