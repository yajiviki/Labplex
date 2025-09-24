'use client';
import { useEffect, useState } from 'react';

type KPIs = {
	total: number;
	today: number;
	report: { reportReady: number; closed: number; canceled: number };
	medical: { booked: number; checkedIn: number; sampling: number; processing: number };
};

export default function KpiTiles() {
	const [kpis, setKpis] = useState<KPIs | null>(null);
	const [err, setErr] = useState<string | null>(null);

	useEffect(() => {
		(async () => {
			try {
				const res = await fetch('/api/metrics', { cache: 'no-store' });
				const data = await res.json();
				if (!res.ok) throw new Error(data?.error || 'Failed to load KPIs');
				setKpis(data);
			} catch (e: any) {
				setErr(e?.message || 'Network error');
			}
		})();
	}, []);

	if (err) return <div className="text-red-600 text-sm">{err}</div>;
	if (!kpis) return <div className="text-sm text-gray-500">Loading KPIs…</div>;

	const tiles = [
		{ label: 'Total Appointments', value: kpis.total },
		{ label: 'Today', value: kpis.today },
		{ label: 'Booked', value: kpis.medical.booked },
		{ label: 'Checked In', value: kpis.medical.checkedIn },
		{ label: 'Sampling', value: kpis.medical.sampling },
		{ label: 'Processing', value: kpis.medical.processing },
		{ label: 'Report Ready', value: kpis.report.reportReady },
		{ label: 'Closed', value: kpis.report.closed },
		{ label: 'Canceled', value: kpis.report.canceled },
	];

	return (
		<div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
			{tiles.map((t) => (
				<div key={t.label} className="rounded-xl border bg-white p-4 shadow-sm">
					<div className="text-xs text-gray-500">{t.label}</div>
					<div className="mt-1 text-2xl font-semibold">{t.value}</div>
				</div>
			))}
		</div>
	);
}
