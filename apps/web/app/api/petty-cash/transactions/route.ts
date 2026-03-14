import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';


function toNumber(value: unknown) {
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
}

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);

		const from = searchParams.get('from');
		const to = searchParams.get('to');
		const accountId = searchParams.get('accountId');
		const txnType = searchParams.get('txnType');

		const where: any = { isActive: 1 };

		if (from || to) {
			where.txnDate = {};
			if (from) where.txnDate.gte = new Date(from);
			if (to) {
				const dt = new Date(to);
				dt.setHours(23, 59, 59, 999);
				where.txnDate.lte = dt;
			}
		}

		if (accountId) where.pettyCashAccountId = accountId;
		if (txnType && ['RECEIVE', 'REPAY'].includes(txnType)) where.txnType = txnType;

		const rows = await prisma.pettyCashTransaction.findMany({
			where,
			include: { pettyCashAccount: true },
			orderBy: [{ txnDate: 'desc' }, { createdAt: 'desc' }],
		});

		return NextResponse.json({ success: true, rows });
	} catch (error) {
		console.error('GET /api/petty-cash/transactions error:', error);
		return NextResponse.json(
			{ success: false, error: 'Failed to fetch petty cash transactions' },
			{ status: 500 }
		);
	}
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();

		const txnType = String(body?.txnType || '').trim();
		const txnDate = body?.txnDate ? new Date(body.txnDate) : null;
		const amount = toNumber(body?.amount);
		const referenceNo = body?.referenceNo ? String(body.referenceNo).trim() : null;
		const notes = body?.notes ? String(body.notes).trim() : null;

		let pettyCashAccountId = body?.pettyCashAccountId ? String(body.pettyCashAccountId).trim() : '';
		const newAccountName = body?.newAccountName ? String(body.newAccountName).trim() : '';
		const newAccountType = body?.newAccountType ? String(body.newAccountType).trim() : 'OTHER';

		if (!['RECEIVE', 'REPAY'].includes(txnType)) {
			return NextResponse.json(
				{ success: false, error: 'Valid transaction type is required' },
				{ status: 400 }
			);
		}

		if (!txnDate || Number.isNaN(txnDate.getTime())) {
			return NextResponse.json(
				{ success: false, error: 'Transaction date is required' },
				{ status: 400 }
			);
		}

		if (amount <= 0) {
			return NextResponse.json(
				{ success: false, error: 'Amount should be greater than 0' },
				{ status: 400 }
			);
		}

		if (!pettyCashAccountId && !newAccountName) {
			return NextResponse.json(
				{ success: false, error: 'Select an account or create a new one' },
				{ status: 400 }
			);
		}

		if (!pettyCashAccountId && newAccountName) {
			const existing = await prisma.pettyCashAccount.findFirst({
				where: {
					name: { equals: newAccountName, mode: 'insensitive' },
					isActive: 1,
				},
			});

			if (existing) {
				pettyCashAccountId = existing.id;
			} else {
				const created = await prisma.pettyCashAccount.create({
					data: {
						name: newAccountName,
						accountType: ['VENDOR', 'PERSON', 'STAFF', 'OTHER'].includes(newAccountType)
							? (newAccountType as any)
							: 'OTHER',
					},
				});
				pettyCashAccountId = created.id;
			}
		}

		const row = await prisma.pettyCashTransaction.create({
			data: {
				pettyCashAccountId,
				txnDate,
				txnType: txnType as any,
				amount,
				referenceNo,
				notes,
			},
			include: { pettyCashAccount: true },
		});

		return NextResponse.json({ success: true, row });
	} catch (error) {
		console.error('POST /api/petty-cash/transactions error:', error);
		return NextResponse.json(
			{ success: false, error: 'Failed to create petty cash transaction' },
			{ status: 500 }
		);
	}
}