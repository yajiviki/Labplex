// apps/web/app/api/users/[id]/route.ts
import { NextResponse } from 'next/server';
import { auth } from '../../../../lib/auth';
import { prisma } from '../../../../lib/db';
//import { prisma } from '../../../lib/db';   // ✅ from app/api/users/[id] → ../../../lib/db
//import { auth } from '../../../lib/auth';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
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

		const id = params.id;
		const { name, phone, userType, role, dob, address, email, employeeId } = body;
		if (!name || !phone || !userType || !role) {
			return NextResponse.json({ error: 'Name, Mobile, User Type and Role are required.' }, { status: 400 });
		}

		const exists = await prisma.user.findFirst({ where: { id, labId } });
		if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

		const updated = await prisma.user.update({
			where: { id },
			data: {
				name,
				phone,
				userType,
				role,
				dob: dob ? new Date(dob) : null,
				address: address || null,
				email: email ?? exists.email,
				employeeId: employeeId ?? exists.employeeId,
			},
			select: {
				id: true, name: true, phone: true, userType: true, role: true,
				dob: true, address: true, email: true, employeeId: true, createdAt: true,
			},
		});

		return NextResponse.json(updated);
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
