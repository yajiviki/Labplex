import FilterDashboardClient from '../../../components/FilterDashboardClient';
import { auth } from '../../../lib/auth';
import { prisma } from '../../../lib/db';


// Helpers: current month range (server-side)
function startOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d = new Date()) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999); }

export default async function DashboardPage() {
	const session = await auth();
	const role = (session as any)?.role as string;
	const userLabId = (session as any)?.labId as string | null;

	// Everyone gets a lab picker; LAB_ADMIN will still see just their lab in the list
	const labs = await prisma.lab.findMany({
		where: { isActive: 1 },
		select: { id: true, name: true },
		orderBy: { name: 'asc' },
	});

	const visibleLabs = (role === 'LAB_ADMIN' && userLabId)
		? labs.filter(l => l.id === userLabId)
		: labs;

	const defaultLabId = visibleLabs[0]?.id ?? null;

	// Default date range = current month (inclusive)
	const from = startOfMonth();
	const to = endOfMonth();

	// Initial “safe” snapshot (client will immediately refetch with API anyway)
	const initialMetrics = {
		totals: {
			todays: 0,
			upcoming: 0,
			uploadPending: 0,
			outOfTat: 0,
			totalInRange: '0 / 0',
			closed: 0,
		},
		// charts prefilled empty for first paint
		charts: {
			appointments: [],
			inprogress: [],
			reports: [],
		},
	};

	return (
		<div className="space-y-4">
			<FilterDashboardClient
				role={role}
				labs={visibleLabs}
				// default to “All Labs” on first load
				initialLabId={'cmg3dgnge0000nmg4yz7cfy5r'}
				initialFrom={from.toISOString()}
				initialTo={to.toISOString()}
				initialMetrics={initialMetrics}
			/>
		</div>
	);
}
