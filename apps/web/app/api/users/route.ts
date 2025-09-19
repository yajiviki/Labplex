// apps/web/app/api/users/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';		// ✅ from app/api/users → ../../lib/db
import { auth } from '../../../lib/auth';

export async function GET() {
	try {
		const session = await auth();
		const labId = (session as any)?.labId as string | undefined;
		if (!labId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const users = await prisma.user.findMany({
			where: { labId },
			orderBy: { createdAt: 'desc' },
			select: {
				id: true, name: true, email: true, employeeId: true,
				role: true, phone: true, dob: true, address: true, userType: true,
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

		let body: any = {};
		try {
			body = await req.json();
		} catch {
			return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
		}

		const { name, phone, userType, role, dob, address, email, employeeId } = body;
		if (!name || !phone || !userType || !role) {
			return NextResponse.json({ error: 'Name, Mobile, User Type and Role are required.' }, { status: 400 });
		}

		const user = await prisma.user.create({
			data: {
				name,
				phone,
				userType,
				role,
				dob: dob ? new Date(dob) : null,
				address: address || null,
				email: email || `${crypto.randomUUID()}@placeholder.local`,
				employeeId: employeeId || null,
				// NOTE: set a proper hash in a real flow. demo123 hash below for placeholder.
				password: '$2a$10$7gZ4m8O2r8q1t0xO5x5XWeLz0g8rU3m1JtT1ZVd8mH0Czq2m6tq0i',
				labId,
			},
			select: {
				id: true, name: true, phone: true, userType: true, role: true,
				dob: true, address: true, email: true, employeeId: true, createdAt: true,
			},
		});

		return NextResponse.json(user, { status: 201 });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
