import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../../../../lib/db';
import { auth } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

const ROLE_WHITELIST = new Set(['USER', 'ADMIN', 'SUPER_ADMIN']);

/* ----------------------------- GET /api/users/[id] ----------------------------- */
export async function GET(_: Request, { params }: { params: { id: string } }) {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const user = await prisma.user.findUnique({
			where: { id: params.id },
			select: {
				id: true,
				userId: true,
				name: true,
				phone: true,
				role: true,
				email: true,
				dob: true,
				address: true,
				isActive: true,
				createdAt: true,
				updatedAt: true,
				labId: true,
				lab: { select: { labCode: true, name: true } },
			},
		});

		if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 });
		return NextResponse.json(user);
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}

/* ----------------------------- PUT /api/users/[id] ----------------------------- */
/** Body: { name, phone, role, dob?, address?, email?, labCode }  */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const body = await req.json().catch(() => ({}));
		const { name, phone, role, dob, address, email, labCode } = body;

		// Validate minimal fields (your form sends all)
		const phoneDigits = String(phone || '').replace(/\D+/g, '');
		if (!labCode?.trim()) return NextResponse.json({ error: 'Please select Lab.' }, { status: 400 });
		if (!name?.trim() || !phoneDigits || !role)
			return NextResponse.json({ error: 'Please fill Name, Mobile and Role.' }, { status: 400 });
		if (phoneDigits.length < 10 || phoneDigits.length > 15)
			return NextResponse.json({ error: 'Please enter a valid Mobile number (10–15 digits).' }, { status: 400 });
		if (!ROLE_WHITELIST.has(role))
			return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });

		// Resolve lab by code
		const targetLab = await prisma.lab.findUnique({
			where: { labCode: labCode.trim() },
			select: { id: true, labCode: true, name: true },
		});
		if (!targetLab) return NextResponse.json({ error: 'Selected Lab Code does not exist.' }, { status: 400 });

		// Load current user
		const current = await prisma.user.findUnique({
			where: { id: params.id },
			select: { id: true, userId: true, labId: true },
		});
		if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

		// If moving to a different lab, ensure (labId,userId) uniqueness won’t clash
		if (current.labId !== targetLab.id) {
			const conflict = await prisma.user.findFirst({
				where: { labId: targetLab.id, userId: current.userId, NOT: { id: current.id } },
				select: { id: true },
			});
			if (conflict) {
				return NextResponse.json(
					{ error: `User ID ${current.userId} already exists in ${targetLab.labCode}.` },
					{ status: 409 },
				);
			}
		}

		const updated = await prisma.user.update({
			where: { id: params.id },
			data: {
				labId: targetLab.id,
				name: name.trim(),
				phone: phoneDigits,
				role,
				email: email?.trim() || null,
				dob: dob ? new Date(dob) : null,
				address: address?.trim() || null,
			},
			select: {
				id: true,
				userId: true,
				name: true,
				phone: true,
				role: true,
				email: true,
				dob: true,
				address: true,
				createdAt: true,
				lab: { select: { labCode: true, name: true } },
			},
		});

		return NextResponse.json(updated);
	} catch (e: any) {
		// Surface composite unique violation clearly (rare on lab move)
		if (e instanceof (Prisma as any).PrismaClientKnownRequestError && e.code === 'P2002') {
			return NextResponse.json({ error: 'Duplicate user in target lab.' }, { status: 409 });
		}
		return NextResponse.json({ error: e?.message || 'Update failed' }, { status: 500 });
	}
}

/* --------------------------- DELETE /api/users/[id] --------------------------- */
/** Soft delete: isActive = 0 */
export async function DELETE(_: Request, { params }: { params: { id: string } }) {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		// Soft delete only if exists
		const exists = await prisma.user.findUnique({ where: { id: params.id }, select: { id: true } });
		if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

		await prisma.user.update({
			where: { id: params.id },
			data: { isActive: 0 },
		});

		return NextResponse.json({ ok: true });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Delete failed' }, { status: 500 });
	}
}
