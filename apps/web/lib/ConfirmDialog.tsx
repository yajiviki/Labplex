'use client';
import { X } from 'lucide-react';

export default function ConfirmDialog({
	open, title, message, confirmText = 'Delete', onConfirm, onClose, danger = true,
}: {
	open: boolean;
	title: string;
	message?: string;
	confirmText?: string;
	danger?: boolean;
	onConfirm: () => void;
	onClose: () => void;
}) {
	if (!open) return null;
	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center">
			<div className="absolute inset-0 bg-black/30" onClick={onClose} />
			<div className="relative z-10 w-full max-w-md rounded-xl border bg-white p-4 shadow-lg">
				<div className="flex items-center justify-between">
					<div className="text-base font-semibold">{title}</div>
					<button onClick={onClose} className="p-1 rounded hover:bg-gray-100" aria-label="Close">
						<X className="h-5 w-5" />
					</button>
				</div>
				{message && <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{message}</div>}
				<div className="mt-4 flex justify-end gap-2">
					<button className="rounded border px-3 py-1.5 text-sm" onClick={onClose}>Cancel</button>
					<button
						className={`rounded px-3 py-1.5 text-sm text-white ${danger ? 'bg-red-600' : 'bg-brand'}`}
						onClick={onConfirm}
					>
						{confirmText}
					</button>
				</div>
			</div>
		</div>
	);
}
