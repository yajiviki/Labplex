import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';


type Period = 'day' | 'week' | 'month' | 'quarter';

function asNum(value: unknown) {
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
}

function pad2(n: number) {
	return String(n).padStart(2, '0');
}

function getWeekStart(date: Date) {
	const d = new Date(date);
	const day = d.getDay();
	const diff = day === 0 ? -6 : 1 - day;
	d.setDate(d.getDate() + diff);
	d.setHours(0, 0, 0, 0);
	return d;
}



function formatBucket(date: Date, period: Period) {
	const d = new Date(date);

	if (period === 'day') return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
	if (period === 'week') {
		const wk = getWeekStart(d);
		return `${wk.getFullYear()}-W${pad2(
			Math.ceil(((((wk.getTime() - new Date(wk.getFullYear(), 0, 1).getTime()) / 86400000) + 1) / 7))
		)}`;
	}
	if (period === 'month') return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

	const q = Math.floor(d.getMonth() / 3) + 1;
	return `${d.getFullYear()}-Q${q}`;
}

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);
		const period = (searchParams.get('period') || 'month') as Period;
		const validPeriod: Period = ['day', 'week', 'month', 'quarter'].includes(period) ? period : 'month';

		const rows = await prisma.pettyCashTransaction.findMany({
			where: { isActive: 1 },
			include: { pettyCashAccount: true },
			orderBy: [{ txnDate: 'asc' }, { createdAt: 'asc' }],
		});

		const totalReceived = rows
			.filter((r) => r.txnType === 'RECEIVE')
			.reduce((sum, r) => sum + asNum(r.amount), 0);

		const totalRepaid = rows
			.filter((r) => r.txnType === 'REPAY')
			.reduce((sum, r) => sum + asNum(r.amount), 0);

		const activeAccounts = new Set(rows.map((r) => r.pettyCashAccountId)).size;

		const trendMap = new Map<string, { label: string; received: number; repaid: number }>();

		for (const row of rows) {
			const label = formatBucket(new Date(row.txnDate), validPeriod);
			if (!trendMap.has(label)) {
				trendMap.set(label, { label, received: 0, repaid: 0 });
			}
			const curr = trendMap.get(label)!;
			if (row.txnType === 'RECEIVE') curr.received += asNum(row.amount);
			if (row.txnType === 'REPAY') curr.repaid += asNum(row.amount);
		}

		const accountMap = new Map<
			string,
			{
				accountId: string;
				name: string;
				accountType: string;
				totalReceived: number;
				totalRepaid: number;
				balance: number;
			}
		>();

		for (const row of rows) {
			if (!accountMap.has(row.pettyCashAccountId)) {
				accountMap.set(row.pettyCashAccountId, {
					accountId: row.pettyCashAccountId,
					name: row.pettyCashAccount.name,
					accountType: row.pettyCashAccount.accountType,
					totalReceived: 0,
					totalRepaid: 0,
					balance: 0,
				});
			}

			const curr = accountMap.get(row.pettyCashAccountId)!;
			if (row.txnType === 'RECEIVE') curr.totalReceived += asNum(row.amount);
			if (row.txnType === 'REPAY') curr.totalRepaid += asNum(row.amount);
			curr.balance = curr.totalReceived - curr.totalRepaid;
		}

		const recentTransactions = [...rows]
			.sort(
				(a, b) =>
					new Date(b.txnDate).getTime() - new Date(a.txnDate).getTime() ||
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
			)
			.slice(0, 100)
			.map((r) => ({
				id: r.id,
				txnDate: r.txnDate,
				txnType: r.txnType,
				amount: asNum(r.amount),
				referenceNo: r.referenceNo,
				notes: r.notes,
				accountId: r.pettyCashAccountId,
				accountName: r.pettyCashAccount.name,
				accountType: r.pettyCashAccount.accountType,
			}));

		return NextResponse.json({
			success: true,
			kpis: {
				totalReceived,
				totalRepaid,
				pendingBalance: totalReceived - totalRepaid,
				activeAccounts,
			},
			trend: Array.from(trendMap.values()).sort((a, b) => a.label.localeCompare(b.label)),
			accountSummary: Array.from(accountMap.values()).sort((a, b) => b.balance - a.balance),
			recentTransactions,
		});
	} catch (error) {
		console.error('GET /api/petty-cash/dashboard error:', error);
		return NextResponse.json(
			{ success: false, error: 'Failed to fetch petty cash dashboard data' },
			{ status: 500 }
		);
	}
}