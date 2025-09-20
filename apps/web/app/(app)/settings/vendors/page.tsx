'use client';

import { useState } from 'react';

export default function ManageVendorsPage() {
	const [vendors, setVendors] = useState([
		{ id: 1, name: 'ABC Insurance', contact: 'support@abc.com' },
		{ id: 2, name: 'XYZ Health', contact: 'info@xyzhealth.com' },
	]);

	return (
		<div className="space-y-6">
			{/* Header */}
			<h1 className="text-2xl font-bold text-gray-800">Manage Vendors</h1>
			<p className="text-sm text-gray-600">
				Add, update, and manage insurance vendors linked to your lab system.
			</p>

			{/* Form */}
			<div className="bg-white shadow rounded-lg p-6">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						const form = e.target as HTMLFormElement;
						const name = (form.elements.namedItem('name') as HTMLInputElement).value;
						const contact = (form.elements.namedItem('contact') as HTMLInputElement).value;

						if (!name || !contact) {
							alert('Both fields are required.');
							return;
						}

						setVendors((prev) => [
							...prev,
							{ id: prev.length + 1, name, contact },
						]);

						form.reset();
					}}
					className="space-y-4"
				>
					<div>
						<label htmlFor="vendor-name" className="block text-sm font-medium mb-1">Vendor Name</label>
						<input
							id="vendor-name"
							name="name"
							type="text"
							placeholder="Enter vendor name"
							className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand/40 outline-none"
						/>
					</div>
					<div>
						<label htmlFor="contact" className="block text-sm font-medium mb-1">Contact Email</label>
						<input
							name="contact"
							type="email"
							placeholder="Enter vendor email"
							className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand/40 outline-none"
						/>
					</div>
					<button
						type="submit"
						className="bg-brand-600 text-white px-4 py-2 rounded-lg hover:bg-brand-700 transition"
					>
						Add Vendor
					</button>
				</form>
			</div>

			{/* Table */}
			<div className="bg-white shadow rounded-lg overflow-hidden">
				<table className="min-w-full divide-y divide-gray-200 text-sm">
					<thead className="bg-gray-50">
						<tr>
							<th className="px-6 py-3 text-left font-medium text-gray-700">ID</th>
							<th className="px-6 py-3 text-left font-medium text-gray-700">Vendor Name</th>
							<th className="px-6 py-3 text-left font-medium text-gray-700">Contact</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-100">
						{vendors.map((v) => (
							<tr key={v.id}>
								<td className="px-6 py-2">{v.id}</td>
								<td className="px-6 py-2">{v.name}</td>
								<td className="px-6 py-2">{v.contact}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
