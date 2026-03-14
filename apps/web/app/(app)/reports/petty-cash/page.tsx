'use client';

import { useEffect, useMemo, useState } from 'react';
import {
	Wallet,
	TrendingUp,
	TrendingDown,
	HandCoins,
	RefreshCw,
	Pencil,
	Trash2,
	X,
} from 'lucide-react';
import {
	ResponsiveContainer,
	LineChart,
	Line,
	CartesianGrid,
	XAxis,
	YAxis,
	Tooltip,
	Legend,
} from 'recharts';

type Account = {
	id: string;
	name: string;
	accountType: 'VENDOR' | 'PERSON' | 'STAFF' | 'OTHER';
};

type RecentTransaction = {
	id: string;
	txnDate: string;
	txnType: 'RECEIVE' | 'REPAY';
	amount: number;
	referenceNo: string | null;
	notes: string | null;
	accountName: string;
	accountType: string;
	accountId?: string;
};

type DashboardResponse = {
	success: boolean;
	kpis: {
		totalReceived: number;
		totalRepaid: number;
		pendingBalance: number;
		activeAccounts: number;
	};
	trend: Array<{
		label: string;
		received: number;
		repaid: number;
	}>;
	accountSummary: Array<{
		accountId: string;
		name: string;
		accountType: string;
		totalReceived: number;
		totalRepaid: number;
		balance: number;
	}>;
	recentTransactions: RecentTransaction[];
};

type TxnType = 'RECEIVE' | 'REPAY';
type Period = 'day' | 'week' | 'month' | 'quarter';
type AccountType = 'VENDOR' | 'PERSON' | 'STAFF' | 'OTHER';

function fmtINR(value: number) {
	return new Intl.NumberFormat('en-IN', {
		style: 'currency',
		currency: 'INR',
		maximumFractionDigits: 2,
	}).format(value || 0);
}

function fmtDate(value?: string | Date | null) {
	if (!value) return '';
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return '';
	return new Intl.DateTimeFormat('en-IN', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
	}).format(d);
}

function todayInput() {
	const d = new Date();
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

function toInputDate(value?: string | Date | null) {
	if (!value) return todayInput();
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return todayInput();
	const yyyy = d.getFullYear();
	const mm = String(d.getMonth() + 1).padStart(2, '0');
	const dd = String(d.getDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}

export default function PettyCashPage() {
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [deletingId, setDeletingId] = useState('');
	const [period, setPeriod] = useState<Period>('month');

	const [accounts, setAccounts] = useState<Account[]>([]);
	const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);

	const [editId, setEditId] = useState('');
	const [txnType, setTxnType] = useState<TxnType>('RECEIVE');
	const [txnDate, setTxnDate] = useState(todayInput());
	const [pettyCashAccountId, setPettyCashAccountId] = useState('');
	const [createNewAccount, setCreateNewAccount] = useState(false);
	const [newAccountName, setNewAccountName] = useState('');
	const [newAccountType, setNewAccountType] = useState<AccountType>('OTHER');
	const [amount, setAmount] = useState('');
	const [referenceNo, setReferenceNo] = useState('');
	const [notes, setNotes] = useState('');
	const [error, setError] = useState('');
	const [success, setSuccess] = useState('');

	async function loadAccounts() {
		const res = await fetch('/api/petty-cash/accounts', { cache: 'no-store' });
		const data = await res.json();
		if (data?.success) setAccounts(data.accounts || []);
	}

	async function loadDashboard(selectedPeriod: Period) {
		const res = await fetch(`/api/petty-cash/dashboard?period=${selectedPeriod}`, {
			cache: 'no-store',
		});
		const data = await res.json();
		if (data?.success) setDashboard(data);
		else setDashboard(null);
	}

	async function loadAll(selectedPeriod: Period = period) {
		setLoading(true);
		setError('');
		try {
			await Promise.all([loadAccounts(), loadDashboard(selectedPeriod)]);
		} catch (e) {
			console.error(e);
			setError('Failed to load petty cash data');
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		loadAll(period);
	}, [period]);

	function resetForm() {
		setEditId('');
		setTxnType('RECEIVE');
		setTxnDate(todayInput());
		setPettyCashAccountId('');
		setCreateNewAccount(false);
		setNewAccountName('');
		setNewAccountType('OTHER');
		setAmount('');
		setReferenceNo('');
		setNotes('');
	}

	function startEdit(row: RecentTransaction) {
		const matchedAccount = accounts.find(
			(a) => a.name === row.accountName && a.accountType === row.accountType
		);

		setEditId(row.id);
		setTxnType(row.txnType);
		setTxnDate(toInputDate(row.txnDate));
		setCreateNewAccount(false);
		setPettyCashAccountId(row.accountId || matchedAccount?.id || '');
		setNewAccountName('');
		setNewAccountType(
			(row.accountType as AccountType) || 'OTHER'
		);
		setAmount(String(row.amount || ''));
		setReferenceNo(row.referenceNo || '');
		setNotes(row.notes || '');
		setError('');
		setSuccess('');
	}

	function cancelEdit() {
		resetForm();
		setError('');
		setSuccess('');
	}

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		setError('');
		setSuccess('');

		try {
			const payload = {
				txnType,
				txnDate,
				pettyCashAccountId: createNewAccount ? '' : pettyCashAccountId,
				newAccountName: createNewAccount ? newAccountName : '',
				newAccountType,
				amount: Number(amount || 0),
				referenceNo,
				notes,
			};

			const isEdit = Boolean(editId);
			const res = await fetch(
				isEdit ? `/api/petty-cash/transactions/${editId}` : '/api/petty-cash/transactions',
				{
					method: isEdit ? 'PUT' : 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				}
			);

			const data = await res.json();

			if (!res.ok || !data?.success) {
				setError(
					data?.error ||
					(isEdit
						? 'Failed to update petty cash transaction'
						: 'Failed to save petty cash transaction')
				);
				return;
			}

			setSuccess(
				isEdit
					? 'Petty cash transaction updated successfully'
					: txnType === 'RECEIVE'
						? 'Petty cash received entry added successfully'
						: 'Petty cash repayment entry added successfully'
			);

			resetForm();
			await loadAll(period);
		} catch (e) {
			console.error(e);
			setError(editId ? 'Failed to update petty cash transaction' : 'Failed to save petty cash transaction');
		} finally {
			setSaving(false);
		}
	}

	async function handleDelete(id: string) {
		const confirmed = window.confirm('Are you sure you want to delete this petty cash transaction?');
		if (!confirmed) return;

		setDeletingId(id);
		setError('');
		setSuccess('');

		try {
			const res = await fetch(`/api/petty-cash/transactions/${id}`, {
				method: 'DELETE',
			});

			const data = await res.json().catch(() => ({}));

			if (!res.ok || !data?.success) {
				setError(data?.error || 'Failed to delete petty cash transaction');
				return;
			}

			if (editId === id) {
				resetForm();
			}

			setSuccess('Petty cash transaction deleted successfully');
			await loadAll(period);
		} catch (e) {
			console.error(e);
			setError('Failed to delete petty cash transaction');
		} finally {
			setDeletingId('');
		}
	}

	const title = useMemo(() => {
		if (editId) {
			return txnType === 'RECEIVE' ? 'Edit Petty Cash Received' : 'Edit Petty Cash Repayment';
		}
		return txnType === 'RECEIVE' ? 'Petty Cash Received' : 'Petty Cash Repayment';
	}, [txnType, editId]);

	return (
		<div className="space-y-6 p-4 md:p-6">
			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
				<div>
					<h1 className="text-2xl font-semibold tracking-tight">Petty Cash</h1>
					<p className="text-sm text-muted-foreground">
						Track petty cash received, repayments, balances, and trend.
					</p>
				</div>

				<button
					onClick={() => loadAll(period)}
					className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-muted"
					type="button"
				>
					<RefreshCw className="h-4 w-4" />
					Refresh
				</button>
			</div>

			{error ? (
				<div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
					{error}
				</div>
			) : null}

			{success ? (
				<div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
					{success}
				</div>
			) : null}

			<div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
				<div className="xl:col-span-2 rounded-2xl border bg-white p-4 shadow-sm">
					<div className="mb-4 flex items-start justify-between gap-3">
						<div>
							<h2 className="text-lg font-semibold">{title}</h2>
							<p className="text-sm text-muted-foreground">
								Use one form for both receive and repayment entries.
							</p>
						</div>

						{editId ? (
							<button
								type="button"
								onClick={cancelEdit}
								className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-muted"
							>
								<X className="h-4 w-4" />
								Cancel Edit
							</button>
						) : null}
					</div>

					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div>
								<label className="mb-1 block text-sm font-medium">Transaction Type</label>
								<select
									value={txnType}
									onChange={(e) => setTxnType(e.target.value as TxnType)}
									className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
								>
									<option value="RECEIVE">Receive</option>
									<option value="REPAY">Repay</option>
								</select>
							</div>

							<div>
								<label className="mb-1 block text-sm font-medium">Date</label>
								<input
									type="date"
									value={txnDate}
									onChange={(e) => setTxnDate(e.target.value)}
									className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
								/>
							</div>
						</div>

						<div className="flex items-center gap-2">
							<input
								id="createNewAccount"
								type="checkbox"
								checked={createNewAccount}
								onChange={(e) => {
									setCreateNewAccount(e.target.checked);
									setPettyCashAccountId('');
								}}
								className="h-4 w-4 rounded border"
							/>
							<label htmlFor="createNewAccount" className="text-sm">
								Add new vendor / person
							</label>
						</div>

						{createNewAccount ? (
							<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
								<div>
									<label className="mb-1 block text-sm font-medium">Name</label>
									<input
										type="text"
										value={newAccountName}
										onChange={(e) => setNewAccountName(e.target.value)}
										placeholder="Enter vendor or person name"
										className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
									/>
								</div>

								<div>
									<label className="mb-1 block text-sm font-medium">Type</label>
									<select
										value={newAccountType}
										onChange={(e) => setNewAccountType(e.target.value as AccountType)}
										className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
									>
										<option value="VENDOR">Vendor</option>
										<option value="PERSON">Person</option>
										<option value="STAFF">Staff</option>
										<option value="OTHER">Other</option>
									</select>
								</div>
							</div>
						) : (
							<div>
								<label className="mb-1 block text-sm font-medium">Vendor / Person</label>
								<select
									value={pettyCashAccountId}
									onChange={(e) => setPettyCashAccountId(e.target.value)}
									className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
								>
									<option value="">Select vendor or person</option>
									{accounts.map((a) => (
										<option key={a.id} value={a.id}>
											{a.name} ({a.accountType})
										</option>
									))}
								</select>
							</div>
						)}

						<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div>
								<label className="mb-1 block text-sm font-medium">
									{txnType === 'RECEIVE' ? 'Amount Received' : 'Amount Repaid'}
								</label>
								<input
									type="number"
									step="0.01"
									min="0"
									value={amount}
									onChange={(e) => setAmount(e.target.value)}
									placeholder="0.00"
									className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
								/>
							</div>

							<div>
								<label className="mb-1 block text-sm font-medium">Reference No</label>
								<input
									type="text"
									value={referenceNo}
									onChange={(e) => setReferenceNo(e.target.value)}
									placeholder="Optional"
									className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
								/>
							</div>
						</div>

						<div>
							<label className="mb-1 block text-sm font-medium">Notes</label>
							<textarea
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								rows={3}
								placeholder="Optional notes"
								className="w-full rounded-xl border px-3 py-2 text-sm outline-none"
							/>
						</div>

						<div className="flex justify-end gap-2">
							{editId ? (
								<button
									type="button"
									onClick={cancelEdit}
									className="rounded-xl border px-4 py-2 text-sm font-medium hover:bg-muted"
								>
									Cancel
								</button>
							) : null}

							<button
								type="submit"
								disabled={saving}
								className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
							>
								{saving
									? editId
										? 'Updating...'
										: 'Saving...'
									: editId
										? 'Update Transaction'
										: txnType === 'RECEIVE'
											? 'Save Receive Entry'
											: 'Save Repayment Entry'}
							</button>
						</div>
					</form>
				</div>

				<div className="xl:col-span-3 rounded-2xl border bg-white p-4 shadow-sm">
					<div className="mb-4 flex items-center justify-between gap-3">
						<div>
							<h2 className="text-lg font-semibold">Cash Trend</h2>
							<p className="text-sm text-muted-foreground">
								Received and repaid trend by selected period
							</p>
						</div>

						<select
							value={period}
							onChange={(e) => setPeriod(e.target.value as Period)}
							className="rounded-xl border px-3 py-2 text-sm outline-none"
						>
							<option value="day">Day</option>
							<option value="week">Week</option>
							<option value="month">Month</option>
							<option value="quarter">Quarter</option>
						</select>
					</div>

					<div className="h-[320px]">
						<ResponsiveContainer width="100%" height="100%">
							<LineChart data={dashboard?.trend || []}>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="label" />
								<YAxis />
								<Tooltip formatter={(v: number) => fmtINR(Number(v || 0))} />
								<Legend />
								<Line type="monotone" dataKey="received" name="Received" strokeWidth={2} dot={false} />
								<Line type="monotone" dataKey="repaid" name="Repaid" strokeWidth={2} dot={false} />
							</LineChart>
						</ResponsiveContainer>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
				<div className="rounded-2xl border bg-white p-4 shadow-sm">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm text-muted-foreground">Total Received</p>
							<p className="mt-1 text-2xl font-semibold">
								{fmtINR(dashboard?.kpis?.totalReceived || 0)}
							</p>
						</div>
						<div className="rounded-2xl border p-3"><TrendingUp className="h-5 w-5" /></div>
					</div>
				</div>

				<div className="rounded-2xl border bg-white p-4 shadow-sm">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm text-muted-foreground">Total Repaid</p>
							<p className="mt-1 text-2xl font-semibold">
								{fmtINR(dashboard?.kpis?.totalRepaid || 0)}
							</p>
						</div>
						<div className="rounded-2xl border p-3"><TrendingDown className="h-5 w-5" /></div>
					</div>
				</div>

				<div className="rounded-2xl border bg-white p-4 shadow-sm">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm text-muted-foreground">Pending Balance</p>
							<p className="mt-1 text-2xl font-semibold">
								{fmtINR(dashboard?.kpis?.pendingBalance || 0)}
							</p>
						</div>
						<div className="rounded-2xl border p-3"><HandCoins className="h-5 w-5" /></div>
					</div>
				</div>

				<div className="rounded-2xl border bg-white p-4 shadow-sm">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm text-muted-foreground">Active Accounts</p>
							<p className="mt-1 text-2xl font-semibold">
								{dashboard?.kpis?.activeAccounts || 0}
							</p>
						</div>
						<div className="rounded-2xl border p-3"><Wallet className="h-5 w-5" /></div>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
				<div className="xl:col-span-2 rounded-2xl border bg-white p-4 shadow-sm">
					<div className="mb-4">
						<h2 className="text-lg font-semibold">Account Summary</h2>
						<p className="text-sm text-muted-foreground">
							Received, repaid, and balance by vendor or person
						</p>
					</div>

					<div className="max-h-[420px] overflow-auto rounded-xl border">
						<table className="min-w-full text-sm">
							<thead className="sticky top-0 bg-muted/50">
								<tr className="border-b text-left">
									<th className="px-3 py-2 font-medium">Name</th>
									<th className="px-3 py-2 font-medium">Type</th>
									<th className="px-3 py-2 font-medium text-right">Balance</th>
								</tr>
							</thead>
							<tbody>
								{(dashboard?.accountSummary || []).map((row) => (
									<tr key={row.accountId} className="border-b last:border-b-0">
										<td className="px-3 py-2">{row.name}</td>
										<td className="px-3 py-2">{row.accountType}</td>
										<td className="px-3 py-2 text-right">{fmtINR(row.balance)}</td>
									</tr>
								))}
								{!dashboard?.accountSummary?.length ? (
									<tr>
										<td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
											No account summary available
										</td>
									</tr>
								) : null}
							</tbody>
						</table>
					</div>
				</div>

				<div className="xl:col-span-3 rounded-2xl border bg-white p-4 shadow-sm">
					<div className="mb-4">
						<h2 className="text-lg font-semibold">Recent Transactions</h2>
						<p className="text-sm text-muted-foreground">
							Last 100 petty cash receive and repayment entries
						</p>
					</div>

					<div className="max-h-[420px] overflow-auto rounded-xl border">
						<table className="min-w-full text-sm">
							<thead className="sticky top-0 bg-muted/50">
								<tr className="border-b text-left">
									<th className="px-3 py-2 font-medium">Date</th>
									<th className="px-3 py-2 font-medium">Name</th>
									<th className="px-3 py-2 font-medium">Type</th>
									<th className="px-3 py-2 font-medium">Txn</th>
									<th className="px-3 py-2 font-medium text-right">Amount</th>
									<th className="px-3 py-2 font-medium">Reference</th>
									<th className="px-3 py-2 font-medium">Notes</th>
									<th className="px-3 py-2 font-medium text-right">Action</th>
								</tr>
							</thead>
							<tbody>
								{(dashboard?.recentTransactions || []).map((row) => {
									const isDeleting = deletingId === row.id;
									const isEditing = editId === row.id;

									return (
										<tr key={row.id} className="border-b last:border-b-0">
											<td className="px-3 py-2">{fmtDate(row.txnDate)}</td>
											<td className="px-3 py-2">{row.accountName}</td>
											<td className="px-3 py-2">{row.accountType}</td>
											<td className="px-3 py-2">{row.txnType}</td>
											<td className="px-3 py-2 text-right">{fmtINR(row.amount)}</td>
											<td className="px-3 py-2">{row.referenceNo || '-'}</td>
											<td className="px-3 py-2">{row.notes || '-'}</td>
											<td className="px-3 py-2">
												<div className="flex items-center justify-end gap-2">
													<button
														type="button"
														onClick={() => startEdit(row)}
														className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs hover:bg-muted"
													>
														<Pencil className="h-3.5 w-3.5" />
														{isEditing ? 'Editing' : 'Edit'}
													</button>

													<button
														type="button"
														onClick={() => handleDelete(row.id)}
														disabled={isDeleting}
														className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60"
													>
														<Trash2 className="h-3.5 w-3.5" />
														{isDeleting ? 'Deleting...' : 'Delete'}
													</button>
												</div>
											</td>
										</tr>
									);
								})}
								{!dashboard?.recentTransactions?.length ? (
									<tr>
										<td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
											No petty cash transactions found
										</td>
									</tr>
								) : null}
							</tbody>
						</table>
					</div>
				</div>
			</div>

			{loading ? <div className="text-sm text-muted-foreground">Loading petty cash data...</div> : null}
		</div>
	);
}