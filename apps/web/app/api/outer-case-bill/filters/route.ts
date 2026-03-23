import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';

export async function GET() {
	try {
		const appointments = await prisma.appointment.findMany({
			where: {
				isActive: 1,
				serviceType: {
					equals: 'Outer',
					mode: 'insensitive',
				},
				OR: [
					{ status: { equals: 'Report - InProgress', mode: 'insensitive' } },
					{ status: { equals: 'Report - Completed', mode: 'insensitive' } },
				],
			},
			select: {
				labId: true,
				vendorId: true,
				location: true,
				lab: {
					select: {
						id: true,
						name: true,
						nickName: true,
						labCode: true,
					},
				},
				vendor: {
					select: {
						id: true,
						tpaName: true,
						nickName: true,
						vendorId: true,
					},
				},
			},
			orderBy: {
				apptAt: 'desc',
			},
		});

		const labMap = new Map<string, { id: string; label: string }>();
		const vendorMap = new Map<string, { id: string; label: string }>();
		const locationSet = new Set<string>();

		for (const appt of appointments) {
			if (appt.labId && appt.lab) {
				const label =
					appt.lab.nickName?.trim() ||
					appt.lab.name?.trim() ||
					appt.lab.labCode?.trim() ||
					'Unknown Lab';

				if (!labMap.has(appt.labId)) {
					labMap.set(appt.labId, {
						id: appt.labId,
						label,
					});
				}
			}

			if (appt.vendorId && appt.vendor) {
				const label =
					appt.vendor.tpaName?.trim() ||
					appt.vendor.nickName?.trim() ||
					appt.vendor.vendorId?.trim() ||
					'Unknown TPA';

				if (!vendorMap.has(appt.vendorId)) {
					vendorMap.set(appt.vendorId, {
						id: appt.vendorId,
						label,
					});
				}
			}

			if (appt.location && appt.location.trim()) {
				locationSet.add(appt.location.trim());
			}
		}

		const labs = Array.from(labMap.values()).sort((a, b) =>
			a.label.localeCompare(b.label)
		);

		const vendors = Array.from(vendorMap.values()).sort((a, b) =>
			a.label.localeCompare(b.label)
		);

		const locations = Array.from(locationSet.values()).sort((a, b) =>
			a.localeCompare(b)
		);

		return NextResponse.json({
			success: true,
			labs,
			vendors,
			locations,
			paymentStatuses: ['Paid', 'Not Paid'],
		});
	} catch (error) {
		console.error('GET /api/outer-case-bill/filters error:', error);
		return NextResponse.json(
			{ success: false, message: 'Failed to fetch outer case bill filters' },
			{ status: 500 }
		);
	}
}