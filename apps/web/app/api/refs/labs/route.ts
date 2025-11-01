import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
	try {
		const labs = await prisma.lab.findMany({
			select: { id: true, name: true },
			orderBy: { name: 'asc' },
		});
		// normalize to string ids for safe <select> usage
		const payload = labs.map(l => ({ id: String(l.id), name: l.name ?? '' }));
		return NextResponse.json({ labs: payload });
	} catch (e: any) {
		console.error('[refs/labs]', e?.message);
		return NextResponse.json({ error: 'Failed to load labs' }, { status: 500 });
	}
}
