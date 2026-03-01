import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function parseYmd(s?: string) {
	if (!s) return null;
	const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	return m ? new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0) : null;
}
function endOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999); }
function toYmd(d: Date) {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const ACTIVE = { isActive: 1 } as const;

const TBI = ['TBI'];
const INPROGRESS = ['Waiting for response', 'Not Responding', 'Rescheduled', 'Need Confirmation', 'On hold', 'Confirmed'];
const CONFIRMED = ['Appointment Confirmed', 'App. Confirmed']; // support both spellings
const SUBMITTED = ['Submitted', 'Submited', 'Report - Submitted'];
const REPORT_PHASE = ['Medical Done', 'OnProcess', 'Report - InProgress', 'Completed'];

type Kind = 'today' | 'upcoming' | 'uploadPending';

export async function POST(req: Request) {
	try {
		const { kind, labId, from, to } = await req.json() as {
			kind: Kind; labId?: string | null; from: string; to: string;
		};

		const fromDate = parseYmd(from);
		const toStart = parseYmd(to);
		if (!fromDate || !toStart) {
			return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
		}
		const toDate = endOfDay(toStart);

		const whereBase: any = { ...ACTIVE };
		if (labId) whereBase.labId = labId;

		let where: any = {};
		const now = new Date();

		if (kind === 'today') {
			const ts = new Date(); ts.setHours(0, 0, 0, 0);
			const te = new Date(); te.setHours(23, 59, 59, 999);
			where = { ...whereBase, apptAt: { gte: ts, lte: te } };
		} else if (kind === 'upcoming') {
			where = {
				...whereBase,
				apptAt: { gt: now },
				OR: [
					{ status: null },
					{ status: '' },
					{ status: { in: [...TBI, ...INPROGRESS, ...CONFIRMED] } },
				],
			};
		} else if (kind === 'uploadPending') {
			// In range, in report phase, and NOT yet submitted
			where = {
				...whereBase,
				apptAt: { gte: fromDate, lte: toDate },
				status: { in: REPORT_PHASE.filter(s => !SUBMITTED.includes(s)) },
			};
		} else {
			return NextResponse.json({ error: 'Unknown kind' }, { status: 400 });
		}

		const rows = await prisma.appointment.findMany({
			where,
			orderBy: { apptAt: 'desc' },
			select: {
				id: true,
				apptAt: true,
				clientName: true,
				clientRef: true,
				status: true,
				// ✅ relation names are lowercase
				lab: { select: { name: true } },
				vendor: { select: { tpaName: true } },
				insuranceCompany: { select: { name: true } },
			},
			take: 2000,
		});

		const data = rows.map(r => ({
			id: r.id,
			apptAt: r.apptAt ? toYmd(new Date(r.apptAt)) : '',
			labName: r.lab?.name ?? '',
			status: r.status ?? '',
			tpaName: r.vendor?.tpaName ?? '',
			insuranceName: r.insuranceCompany?.name ?? '',
			clientName: r.clientName ?? '',
			clientRef: r.clientRef ?? '',
		}));

		return NextResponse.json({ items: data });
	} catch (e: any) {
		console.error('[details] error:', e?.message, e?.stack);
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
