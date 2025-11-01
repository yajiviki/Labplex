'use client';

import { useState } from 'react';
import { Trash2, FileDown } from 'lucide-react';
import { ReceiptActions, ReceiptData } from '../components/ReceiptPDF';
import ConfirmDialog from './ConfirmDialog';


export default function TableActions({
	receiptData,
	receiptFileName = 'receipt.pdf',
	deleteUrl,
	onAfterDelete,
}: {
	receiptData?: ReceiptData;
	receiptFileName?: string;
	deleteUrl: string;              // e.g. `/api/appointments/${id}` or `/api/billing/${id}`
	onAfterDelete?: () => void;     // reload function
}) {
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState<string | null>(null);

	async function doDelete() {
		try {
			setBusy(true);
			setErr(null);
			const res = await fetch(deleteUrl, { method: 'DELETE' });
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.error || 'Delete failed');
			setOpen(false);
			onAfterDelete?.();
		} catch (e: any) {
			setErr(e?.message || 'Delete failed');
		} finally {
			setBusy(false);
		}
	}

	return (
		<div className="inline-flex items-center gap-2">
			{receiptData ? (
				// Small compact button using your Receipt component
				<div className="inline-flex">
					<ReceiptActions data={receiptData} fileName={receiptFileName} />
				</div>
			) : (
				<button className="inline-flex items-center gap-1 border rounded px-3 py-1.5 text-sm" disabled>
					<FileDown className="h-4 w-4" /> Receipt
				</button>
			)}

			<button
				type="button"
				className="inline-flex items-center gap-1 rounded border px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
				onClick={() => setOpen(true)}
				title="Delete"
			>
				<Trash2 className="h-4 w-4" /> Delete
			</button>

			<ConfirmDialog
				open={open}
				title="Delete this record?"
				message={err ? `Error: ${err}` : 'This will mark the record as deleted. You can’t undo this.'}
				onConfirm={busy ? () => { } : doDelete}
				onClose={() => { if (!busy) setOpen(false); }}
			/>
		</div>
	);
}
