import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';


export async function GET() {
	try {
		const accounts = await prisma.pettyCashAccount.findMany({
			where: { isActive: 1 },
			orderBy: [{ name: 'asc' }],
		});

		return NextResponse.json({ success: true, accounts });
	} catch (error) {
		console.error('GET /api/petty-cash/accounts error:', error);
		return NextResponse.json(
			{ success: false, error: 'Failed to fetch petty cash accounts' },
			{ status: 500 }
		);
	}
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();

		const name = String(body?.name || '').trim();
		const accountType = String(body?.accountType || 'OTHER').trim();
		const phone = body?.phone ? String(body.phone).trim() : null;
		const notes = body?.notes ? String(body.notes).trim() : null;

		if (!name) {
			return NextResponse.json(
				{ success: false, error: 'Account name is required' },
				{ status: 400 }
			);
		}

		const existing = await prisma.pettyCashAccount.findFirst({
			where: {
				name: { equals: name, mode: 'insensitive' },
				isActive: 1,
			},
		});

		if (existing) {
			return NextResponse.json({ success: true, account: existing });
		}

		const account = await prisma.pettyCashAccount.create({
			data: {
				name,
				accountType: ['VENDOR', 'PERSON', 'STAFF', 'OTHER'].includes(accountType)
					? (accountType as any)
					: 'OTHER',
				phone,
				notes,
			},
		});

		return NextResponse.json({ success: true, account });
	} catch (error) {
		console.error('POST /api/petty-cash/accounts error:', error);
		return NextResponse.json(
			{ success: false, error: 'Failed to create petty cash account' },
			{ status: 500 }
		);
	}
}