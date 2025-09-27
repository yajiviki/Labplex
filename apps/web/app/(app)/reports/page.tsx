// app/reports/page.tsx
'use client';
import { FileText } from 'lucide-react';

export default function ReportsPage() {
	return (
		<div className="p-6">
			<div className="flex items-center gap-2 mb-4">
				<FileText className="h-6 w-6 text-blue-600" />
				<h1 className="text-2xl font-bold">Reports</h1>
			</div>
			<p className="text-gray-600">This is a placeholder for Reports. You can show patient reports, lab reports, or export CSV/PDF here.</p>
		</div>
	);
}
