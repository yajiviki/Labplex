import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';

export const dynamic = 'force-dynamic';

function parseInsNum(code?: string | null) {
	if (!code || !code.startsWith('INS')) return NaN;
	const n = parseInt(code.slice(3), 10);
	return Number.isFinite(n) ? n : NaN;
}

async function nextInsCode(): Promise<string> {
	const latest = await prisma.insuranceCompany.findFirst({
		where: { isActive: 1 },
		orderBy: { code: 'desc' },
		select: { code: true },
	});

	const lastN = Number.isFinite(parseInsNum(latest?.code))
		? (parseInsNum(latest!.code) as number)
		: 0;

	return `INS${String(lastN + 1).padStart(2, '0')}`;
}

export async function GET() {
	try {
		const items = await prisma.insuranceCompany.findMany({
			where: { isActive: 1 },
			orderBy: { name: 'asc' },
			select: {
				id: true,
				code: true,
				name: true,
				nickName: true, // <— added
				address: true,
				phone: true,
				isActive: true,
				createdAt: true,
				updatedAt: true,
			},
		});
		return NextResponse.json(items);
	} catch (e: any) {
		return NextResponse.json(
			{ error: e?.message || 'Failed to load insurance companies' },
			{ status: 500 }
		);
	}
}

export async function POST(req: Request) {
	try {
		const body = await req.json().catch(() => ({}));

		const name = String(body?.name || '').trim();
		if (!name) {
			return NextResponse.json({ error: 'Insurance name is required.' }, { status: 400 });
		}

		let code: string =
			typeof body?.code === 'string' && body.code.trim()
				? body.code.trim()
				: await nextInsCode();

		// simple ensure-unique
		for (let i = 0; i < 5; i++) {
			const exists = await prisma.insuranceCompany.findUnique({ where: { code } });
			if (!exists) break;
			code = await nextInsCode();
		}

		const created = await prisma.insuranceCompany.create({
			data: {
				code,
				name,
				nickName: (body?.nickName ?? null) || null, // <— added
				address: (body?.address ?? null) || null,
				phone: (body?.phone ?? null) || null,
				isActive: 1,
			},
			select: {
				id: true,
				code: true,
				name: true,
				nickName: true,
				address: true,
				phone: true,
				isActive: true,
				createdAt: true,
				updatedAt: true,
			},
		});

		return NextResponse.json(created);
	} catch (e: any) {
		return NextResponse.json(
			{ error: e?.message || 'Create failed' },
			{ status: 500 }
		);
	}
}
