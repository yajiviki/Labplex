// app/billing/page.tsx
'use client';
import { CreditCard } from 'lucide-react';

export default function BillingPage() {
	return (
		<div className="p-6">
			<div className="flex items-center gap-2 mb-4">
				<CreditCard className="h-6 w-6 text-green-600" />
				<h1 className="text-2xl font-bold">App Configurations</h1>
			</div>
			<p className="text-gray-600">This is a placeholder for Billing. Show invoices, payments, and outstanding balances here.</p>
		</div>
	);
}
