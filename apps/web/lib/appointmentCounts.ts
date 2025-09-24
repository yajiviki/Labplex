// apps/web/lib/appointmentCounts.ts
import { prisma } from '../lib/db';

// Defensive helper to build where with optional labId
const baseWhere = (labId?: string) =>
	({ isActive: 1, ...(labId ? { labId } : {}) }) as const;

/**
 * Canonical counters for the new Appointment schema.
 * Use these instead of ad-hoc .count() scattered around the app.
 */
export async function getAppointmentCounts(labId?: string) {
	const whereBase = baseWhere(labId);

	// Simple totals
	const total = await prisma.appointment.count({ where: whereBase });

	// Report pipeline (replaces legacy `status`)
	const reportReady = await prisma.appointment.count({ where: { ...whereBase, reportStatus: 'REPORT_READY' } });
	const closed = await prisma.appointment.count({ where: { ...whereBase, reportStatus: 'CLOSED' } });
	const canceled = await prisma.appointment.count({ where: { ...whereBase, reportStatus: 'CANCELED' } });

	// Medical pipeline (sampling/processing etc.)
	const booked = await prisma.appointment.count({ where: { ...whereBase, medicalStatus: 'BOOKED' } });
	const checkedIn = await prisma.appointment.count({ where: { ...whereBase, medicalStatus: 'CHECKED_IN' } });
	const sampling = await prisma.appointment.count({ where: { ...whereBase, medicalStatus: 'SAMPLING' } });
	const processing = await prisma.appointment.count({ where: { ...whereBase, medicalStatus: 'PROCESSING' } });

	// Example: today’s appointments
	const start = new Date(); start.setHours(0, 0, 0, 0);
	const end = new Date(); end.setHours(23, 59, 59, 999);
	const today = await prisma.appointment.count({
		where: { ...whereBase, apptAt: { gte: start, lte: end } },
	});

	return {
		total,
		today,
		report: { reportReady, closed, canceled },
		medical: { booked, checkedIn, sampling, processing },
	};
}

/**
 * If you really need an aggregate, use .aggregate (example):
 */
export async function getClosedAggregate(labId?: string) {
	return prisma.appointment.aggregate({
		_count: { _all: true },
		where: { ...baseWhere(labId), reportStatus: 'CLOSED' },
	});
}
