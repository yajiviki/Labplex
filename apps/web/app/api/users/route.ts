import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '../../../lib/auth';
import { prisma } from '../../../lib/db';

type UserType = 'PATIENT' | 'STAFF';
const PREFIX: Record<UserType, string> = { PATIENT: 'OP', STAFF: 'Emp' };

function parseSuffix(id: string, prefix: string): number {
	if (!id?.startsWith(prefix)) return 0;
	const n = parseInt(id.slice(prefix.length), 10);
	return Number.isFinite(n) ? n : 0;
}

function generatePassword(length = 10) {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
	let pwd = '';
	for (let i = 0; i < length; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
	return pwd;
}

export async function GET() {
	try {
		const session = await auth();
		const labId = (session as any)?.labId as string | undefined;
		if (!labId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const users = await prisma.user.findMany({
			where: { labId, isActive: 1 },
			orderBy: { createdAt: 'desc' },
			select: {
				id: true,
				employeeId: true,
				userType: true,
				name: true,
				phone: true,
				role: true,
				createdAt: true,
			},
		});

		return NextResponse.json(users);
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}

export async function POST(req: Request) {
	try {
		const session = await auth();
		const labId = (session as any)?.labId as string | undefined;
		if (!labId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const body = await req.json().catch(() => ({}));
		const { name, phone, role, dob, address, email } = body;
		const userType = body.userType as UserType | undefined;

		if (!userType || !['PATIENT', 'STAFF'].includes(userType))
			return NextResponse.json({ error: 'User Type must be PATIENT or STAFF.' }, { status: 400 });
		if (!name?.trim() || !phone?.trim() || !role)
			return NextResponse.json({ error: 'Please fill Name, Mobile and Role.' }, { status: 400 });
		if (!['USER', 'ADMIN', 'SUPER_ADMIN'].includes(role))
			return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });

		// create a random password and hash it for DB
		const rawPassword = generatePassword(12);
		const passwordHash = await bcrypt.hash(rawPassword, 10);

		const created = await prisma.$transaction(async (tx) => {
			// next employeeId based on userType prefix
			const prefix = PREFIX[userType];
			const last = await tx.user.findFirst({
				where: { labId, userType, employeeId: { startsWith: prefix } },
				orderBy: { employeeId: 'desc' },
				select: { employeeId: true },
			});
			const lastN = last?.employeeId ? parseSuffix(last.employeeId, prefix) : 0;
			const nextId = `${prefix}${String(lastN + 1).padStart(4, '0')}`;

			const user = await tx.user.create({
				data: {
					labId,
					employeeId: nextId,
					userType,
					name: name.trim(),
					phone: phone.trim(),
					role,
					email: email?.trim() || null,
					password: passwordHash,
					dob: dob ? new Date(dob) : null,
					address: address?.trim() || null,
					isActive: 1,
				},
				select: {
					id: true,
					employeeId: true,
					userType: true,
					name: true,
					phone: true,
					role: true,
					createdAt: true,
				},
			});

			return { user };
		});

		// Return the raw password ONCE so admin can share manually
		return NextResponse.json(
			{ ...created.user, defaultPassword: rawPassword },
			{ status: 201 }
		);
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
