import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

function canManageAll(role?: string | null) {
	return role === 'SUPER_ADMIN' || role === 'ADMIN';
}
function canManageOwn(role?: string | null) {
	return role === 'LAB_ADMIN' || role === 'STAFF';
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const role = (session as any)?.user?.role as string | undefined;
		const sessionLabId = (session as any)?.user?.labId as string | undefined;

		if (!canManageAll(role) && !canManageOwn(role)) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

		const id = params.id;
		if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

		const body = await req.json().catch(() => ({}));

		// Load current row
		const current = await prisma.appointment.findUnique({
			where: { id },
			select: { id: true, labId: true, isActive: true },
		});
		if (!current || current.isActive !== 1) {
			return NextResponse.json({ error: 'Not found' }, { status: 404 });
		}

		// Only own lab unless admin
		if (!canManageAll(role) && current.labId !== sessionLabId) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

		// Optional admin lab move via labCode
		let nextLabId: string | undefined;
		if (body.labCode) {
			if (!canManageAll(role)) {
				return NextResponse.json({ error: 'Forbidden to move between labs' }, { status: 403 });
			}
			const lab = await prisma.lab.findUnique({
				where: { labCode: String(body.labCode).trim() },
				select: { id: true },
			});
			if (!lab) return NextResponse.json({ error: 'Invalid Lab Code.' }, { status: 400 });
			nextLabId = lab.id;
		}

		// Normalize phone if provided
		let phoneDigits: string | undefined;
		if (body.phone != null) {
			phoneDigits = String(body.phone).replace(/\D+/g, '');
			if (phoneDigits && (phoneDigits.length < 10 || phoneDigits.length > 15)) {
				return NextResponse.json(
					{ error: 'Please enter a valid Mobile number (10–15 digits).' },
					{ status: 400 }
				);
			}
		}

		const updated = await prisma.appointment.update({
			where: { id },
			data: {
				...(nextLabId ? { labId: nextLabId } : {}),
				// keep your existing fields; set only if provided
				...(body.patientId !== undefined ? { patientId: body.patientId } : {}),
				...(body.patientName !== undefined ? { patientName: body.patientName } : {}),
				...(body.phone !== undefined ? { phone: phoneDigits ?? null } : {}),
				...(body.source !== undefined ? { source: body.source } : {}),
				...(body.visitType !== undefined ? { visitType: body.visitType } : {}),
				...(body.doctorName !== undefined ? { doctorName: body.doctorName } : {}),
				...(body.insuranceVendorId !== undefined ? { insuranceVendorId: body.insuranceVendorId } : {}),
				...(body.apptAt ? { apptAt: new Date(body.apptAt) } : {}),
				...(body.status !== undefined ? { status: body.status } : {}),
				...(body.tatHours !== undefined ? { tatHours: body.tatHours } : {}),
				...(body.notes !== undefined ? { notes: body.notes } : {}),
				// extended fields (if present in your schema)
				...(body.gender !== undefined ? { gender: body.gender } : {}),
				...(body.age !== undefined ? { age: typeof body.age === 'number' ? body.age : null } : {}),
				...(body.address !== undefined ? { address: body.address } : {}),
				...(body.tpaName !== undefined ? { tpaName: body.tpaName } : {}),
				...(body.insuranceName !== undefined ? { insuranceName: body.insuranceName } : {}),
				...(body.testCode !== undefined ? { testCode: body.testCode } : {}),
				...(body.testDescription !== undefined ? { testDescription: body.testDescription } : {}),
				...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
			},
			select: {
				id: true, labId: true,
				patientId: true, patientName: true, phone: true,
				source: true, visitType: true, doctorName: true, insuranceVendorId: true,
				apptAt: true, status: true, tatHours: true, notes: true,
				gender: true, age: true, address: true, tpaName: true, insuranceName: true,
				testCode: true, testDescription: true,
				isActive: true, updatedAt: true,
				lab: { select: { labCode: true, name: true } },
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
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const role = (session as any)?.user?.role as string | undefined;
		const sessionLabId = (session as any)?.user?.labId as string | undefined;

		if (!canManageAll(role) && !canManageOwn(role)) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

		const current = await prisma.appointment.findUnique({
			where: { id: params.id },
			select: { id: true, labId: true, isActive: true },
		});
		if (!current || current.isActive !== 1) {
			return NextResponse.json({ error: 'Not found' }, { status: 404 });
		}

		if (!canManageAll(role) && current.labId !== sessionLabId) {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
		}

		await prisma.appointment.update({
			where: { id: params.id },
			data: { isActive: 0 },
		});

		return NextResponse.json({ ok: true });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
