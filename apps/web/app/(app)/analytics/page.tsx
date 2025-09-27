// app/analytics/page.tsx
'use client';
import { BarChart3 } from 'lucide-react';

export default function AnalyticsPage() {
	return (
		<div className="p-6">
			<div className="flex items-center gap-2 mb-4">
				<BarChart3 className="h-6 w-6 text-purple-600" />
				<h1 className="text-2xl font-bold">Analytics</h1>
			</div>
			<p className="text-gray-600">This is a placeholder for Analytics. You can embed charts, KPIs, and dashboards here.</p>
		</div>
	);
}
