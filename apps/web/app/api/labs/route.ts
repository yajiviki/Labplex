import { NextResponse } from 'next/server';
import { auth } from '../../../lib/auth';
import { prisma } from '../../../lib/db';


function parseSuffix(code: string, prefix: string) {
	if (!code?.startsWith(prefix)) return 0;
	const n = parseInt(code.slice(prefix.length), 10);
	return Number.isFinite(n) ? n : 0;
}

export async function GET() {
	try {
		const session = await auth();
		const role = (session as any)?.role as string | undefined;
		if (!role) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const labs = await prisma.lab.findMany({
			where: { isActive: 1 },
			orderBy: { createdAt: 'desc' },
			select: { id: true, labCode: true, name: true, address: true, phone: true, email: true, createdAt: true },
		});
		return NextResponse.json(labs);
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}

export async function POST(req: Request) {
	try {
		const session = await auth();
		const role = (session as any)?.role as string | undefined;
		if (!(role === 'ADMIN' || role === 'SUPER_ADMIN'))
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

		const { name, address, phone, email } = await req.json().catch(() => ({}));
		if (!name?.trim() || !phone?.trim())
			return NextResponse.json({ error: 'Please fill Name and Mobile.' }, { status: 400 });

		// Generate next labCode: LB01, LB02 …
		const prefix = 'LB';
		const last = await prisma.lab.findFirst({
			where: { labCode: { startsWith: prefix } },
			orderBy: { labCode: 'desc' },
			select: { labCode: true },
		});
		const lastN = last?.labCode ? parseSuffix(last.labCode, prefix) : 0;
		const nextCode = `${prefix}${String(lastN + 1).padStart(2, '0')}`;

		const lab = await prisma.lab.create({
			data: {
				labCode: nextCode,
				name: name.trim(),
				address: address?.trim() || null,
				phone: phone.trim(),
				email: email?.trim() || null,
				isActive: 1,
			},
			select: { id: true, labCode: true, name: true, address: true, phone: true, email: true, createdAt: true },
		});

		return NextResponse.json(lab, { status: 201 });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
