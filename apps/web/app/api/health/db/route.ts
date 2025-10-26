import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';


export async function GET() {
	try {
		// list sqlite tables
		const tables = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
    `;
		return NextResponse.json({
			databaseUrl: process.env.DATABASE_URL,
			tables: tables.map(t => t.name)
		});
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'error', databaseUrl: process.env.DATABASE_URL }, { status: 500 });
	}
}
