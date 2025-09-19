import { auth } from '../../../lib/auth';
import { prisma } from '../../../lib/db';

const TILE_CLASSES = 'rounded-lg border bg-white p-4 shadow-sm';

export default async function DashboardPage() {
	const session = await auth();
	const role = (session as any)?.role as string;
	const labId = (session as any)?.labId as string;

	// Minimal fake KPIs; replace with analytics later.
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

	const [todays, upcoming, totalClosed] = await Promise.all([
		prisma.appointment.count({ where: { labId, startAt: { gte: today, lt: tomorrow } } }),
		prisma.appointment.count({ where: { labId, startAt: { gt: tomorrow } } }),
		prisma.appointment.count({ where: { labId, status: 'CLOSED' } })
	]);

	const outOfTat = 0; // placeholder until TAT logic
	const reportUploadPending = 0; // placeholder until report module

	return (
		<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
			<Tile title="Today's Appointments" value={todays} />
			<Tile title="Upcoming Appointments" value={upcoming} />
			<Tile title="Report Upload Pending" value={reportUploadPending} />
			<Tile title="Out Of TAT" value={outOfTat} />
			<Tile title="Total Appointments" value={todays + upcoming} />
			<Tile title="Closed Appointments" value={totalClosed} />
			<div className="md:col-span-3 mt-2">
				<RolePanel role={role} />
			</div>
		</div>
	);
}

function Tile({ title, value }: { title: string; value: number | string }) {
	return (
		<div className={TILE_CLASSES}>
			<div className="text-sm text-gray-500">{title}</div>
			<div className="text-2xl font-semibold mt-1">{value}</div>
		</div>
	);
}

function RolePanel({ role }: { role: string }) {
	if (role === 'LAB_ADMIN') return (
		<div className="rounded-lg border bg-white p-4 shadow-sm">
			<h3 className="font-semibold">Lab Admin Panel</h3>
			<ul className="list-disc list-inside text-sm text-gray-700 mt-2">
				<li>Manage staff & roles</li>
				<li>Configure TAT & instruments</li>
				<li>View lab-wide KPIs</li>
			</ul>
		</div>
	);
	if (role === 'ORG_ADMIN' || role === 'SUPER_ADMIN') return (
		<div className="rounded-lg border bg-white p-4 shadow-sm">
			<h3 className="font-semibold">Org/Super Admin Panel</h3>
			<p className="text-sm text-gray-700 mt-2">Cross-lab metrics and controls.</p>
		</div>
	);
	return (
		<div className="rounded-lg border bg-white p-4 shadow-sm">
			<h3 className="font-semibold">Staff Panel</h3>
			<p className="text-sm text-gray-700 mt-2">Today’s queues and quick actions will appear here.</p>
		</div>
	);
}