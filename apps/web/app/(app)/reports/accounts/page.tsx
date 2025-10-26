import { prisma } from '../../../../lib/db';
import AccountsReportClient from './ui/AccountsReportClient';

function startOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999); }
function toYmd(d: Date) {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default async function AccountsPage() {
	// minimal lists
	const [labs, vendors] = await Promise.all([
		prisma.lab.findMany({ where: { isActive: 1 }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
		prisma.vendor.findMany({ where: { isActive: 1 }, select: { id: true, tpaName: true }, orderBy: { tpaName: 'asc' } }),
	]);

	const from = toYmd(startOfMonth());
	const to = toYmd(endOfMonth());

	//debugger;
	// initial data for "All Labs + All TPA"

	const res = await fetch('/api/reports/accounts', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		// when rendering on server without absolute URL, omit the fetch and let the client load on mount if you prefer
		body: JSON.stringify({ labId: null, vendorId: null, from, to }),
		cache: 'no-store',
	}).catch(() => null);

	const initial = res && res.ok ? await res.json() : { table: [], trend: [] };

	return (
		<div className="p-4">
			<AccountsReportClient
				labs={labs.map(l => ({ id: l.id, name: l.name }))}
				vendors={vendors.map(v => ({ id: v.id, tpaName: v.tpaName }))}
				initialFrom={from}
				initialTo={to}
				initialLabId={''}
				initialVendorId={''}
				initialData={initial}
			/>
		</div>
	);
}
