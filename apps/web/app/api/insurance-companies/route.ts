import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/db';
import { auth } from '../../../lib/auth';


export async function GET(req: Request) {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const url = new URL(req.url);
		const vendorId = url.searchParams.get('vendorId') || undefined;

		const items = await prisma.insuranceCompany.findMany({
			where: { isActive: 1, ...(vendorId ? { vendorId } : {}) },
			orderBy: { name: 'asc' },
			select: { id: true, name: true, code: true, vendorId: true },
		});
		return NextResponse.json(items);
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}

export async function POST(req: Request) {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const { vendorId, name, code } = await req.json().catch(() => ({}));
		if (!vendorId || !name?.trim()) {
			return NextResponse.json({ error: 'vendorId and name are required.' }, { status: 400 });
		}
		const created = await prisma.insuranceCompany.create({
			data: { vendorId, name: name.trim(), code: code?.trim() || null, isActive: 1 },
			select: { id: true, name: true, code: true, vendorId: true },
		});
		return NextResponse.json(created, { status: 201 });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
