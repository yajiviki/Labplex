// app/api/vendors/by-lab/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
	try {
		const url = new URL(req.url);
		const labId = url.searchParams.get('labId');
		if (!labId) return NextResponse.json({ rows: [] });

		const links = await prisma.labVendor.findMany({
			where: { labId },
			include: { vendor: { select: { id: true, vendorId: true, tpaName: true, nickName: true } } },
		});

		const rows = links.map(l => l.vendor);
		return NextResponse.json({ rows });
	} catch (e: any) {
		console.error('[vendors/by-lab][GET] fatal:', e?.message, e?.stack);
		return NextResponse.json({ error: e?.message || 'Failed to load' }, { status: 500 });
	}
}
