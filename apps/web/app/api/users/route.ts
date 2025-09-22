import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../../../lib/db';
import { auth } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

/* ============================================
   Utilities
============================================ */

const ROLE_WHITELIST = new Set(['USER', 'ADMIN', 'SUPER_ADMIN']);

function parseSuffix(id: string | null | undefined, prefix: string): number {
	if (!id || !id.startsWith(prefix)) return 0;
	const n = parseInt(id.slice(prefix.length), 10);
	return Number.isFinite(n) ? n : 0;
}

function generatePassword(length = 12) {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
	let pwd = '';
	for (let i = 0; i < length; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
	return pwd;
}

/** Compute the next Uxxxx for THIS lab inside a transaction. */
async function nextUserIdForLab(tx: Prisma.TransactionClient, labId: string): Promise<string> {
	const last = await tx.user.findFirst({
		where: { labId, userId: { startsWith: 'U' } },
		orderBy: { userId: 'desc' },
		select: { userId: true },
	});
	const lastN = parseSuffix(last?.userId, 'U');
	return `U${String(lastN + 1).padStart(4, '0')}`;
}

/* ============================================
   GET /api/users  -> list active users (all labs)
============================================ */
export async function GET() {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const users = await prisma.user.findMany({
			where: { isActive: 1 },
			orderBy: { createdAt: 'desc' },
			select: {
				id: true,
				userId: true,
				name: true,
				phone: true,
				role: true,
				dob: true,
				address: true,
				email: true,
				createdAt: true,
				labId: true,
				lab: { select: { labCode: true, name: true } },
			},
		});

		return NextResponse.json(users);
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}

/* ============================================
   POST /api/users  -> create user (uses labCode)
   Body: { name, phone, role, dob?, address?, email?, labCode }
============================================ */
export async function POST(req: Request) {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const body = await req.json().catch(() => ({}));
		const { name, phone, role, dob, address, email, labCode } = body;

		// Validate labCode
		if (!labCode?.trim()) {
			return NextResponse.json({ error: 'Please select a Lab.' }, { status: 400 });
		}

		const lab = await prisma.lab.findUnique({
			where: { labCode: labCode.trim() },
			select: { id: true, labCode: true, name: true },
		});
		if (!lab) {
			return NextResponse.json({ error: 'Selected Lab Code does not exist.' }, { status: 400 });
		}

		// Normalize + validate phone
		const phoneDigits = String(phone || '').replace(/\D+/g, '');
		if (!name?.trim() || !phoneDigits || !role) {
			return NextResponse.json({ error: 'Please fill Name, Mobile and Role.' }, { status: 400 });
		}
		if (phoneDigits.length < 10 || phoneDigits.length > 15) {
			return NextResponse.json({ error: 'Please enter a valid Mobile number (10–15 digits).' }, { status: 400 });
		}
		if (!ROLE_WHITELIST.has(role)) {
			return NextResponse.json({ error: 'Invalid role.' }, { status: 400 });
		}

		const rawPassword = generatePassword(12);
		const passwordHash = await bcrypt.hash(rawPassword, 10);

		// Retry a few times in case of collision on @@unique([labId, userId])
		let attempts = 0;
		while (attempts < 5) {
			attempts++;
			try {
				const created = await prisma.$transaction(async (tx) => {
					const nextId = await nextUserIdForLab(tx, lab.id);

					const user = await tx.user.create({
						data: {
							labId: lab.id,                 // resolved from labCode
							userId: nextId,                // U0001...
							name: name.trim(),
							phone: phoneDigits,
							role,
							email: email?.trim() || null,
							password: passwordHash,
							dob: dob ? new Date(dob) : null,
							address: address?.trim() || null,
							isActive: 1,
						},
						select: {
							id: true,
							userId: true,
							name: true,
							phone: true,
							role: true,
							email: true,
							createdAt: true,
							lab: { select: { labCode: true, name: true } },
						},
					});

					return user;
				});

				// Return default password once (for your clipboard modal)
				return NextResponse.json({ ...created, defaultPassword: rawPassword }, { status: 201 });
			} catch (e: any) {
				if (
					e instanceof Prisma.PrismaClientKnownRequestError &&
					e.code === 'P2002' &&
					String(e.meta?.target || '').includes('labId_userId')
				) {
					continue; // try next number
				}
				throw e;
			}
		}

		return NextResponse.json({ error: 'Could not allocate a unique userId. Please retry.' }, { status: 409 });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
