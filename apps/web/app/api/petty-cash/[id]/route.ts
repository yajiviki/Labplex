import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';


function asNum(v: unknown): number {
	if (v == null) return 0;
	if (typeof v === 'number') return v;
	if (typeof v === 'string') return Number(v) || 0;
	if (typeof v === 'object' && v && 'toString' in v) return Number((v as any).toString()) || 0;
	return 0;
}

function serializeRow(row: any) {
	return {
		id: row.id,
		entryDate: row.entryDate,
		amount: asNum(row.amount),
		description: row.description ?? '',
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

type RouteContext = {
	params: Promise<{ id: string }>;
};

export async function PUT(req: NextRequest, context: RouteContext) {
	try {
		const { id } = await context.params;
		const body = await req.json();

		const entryDate = body.entryDate ? new Date(body.entryDate) : null;
		const amount = asNum(body.amount);
		const description = String(body.description || '').trim() || null;

		if (!entryDate || Number.isNaN(entryDate.getTime())) {
			return NextResponse.json(
				{ ok: false, error: 'Valid date is required' },
				{ status: 400 }
			);
		}

		if (amount <= 0) {
			return NextResponse.json(
				{ ok: false, error: 'Amount must be greater than 0' },
				{ status: 400 }
			);
		}

		const existing = await prisma.pettyCashEntry.findUnique({
			where: { id },
		});

		if (!existing) {
			return NextResponse.json(
				{ ok: false, error: 'Petty cash entry not found' },
				{ status: 404 }
			);
		}

		const row = await prisma.pettyCashEntry.update({
			where: { id },
			data: {
				entryDate,
				amount,
				description,
			},
		});

		return NextResponse.json({ ok: true, row: serializeRow(row) });
	} catch (error: any) {
		console.error('PUT /api/petty-cash/[id] error:', error);
		return NextResponse.json(
			{ ok: false, error: error?.message || 'Failed to update petty cash entry' },
			{ status: 500 }
		);
	}
}