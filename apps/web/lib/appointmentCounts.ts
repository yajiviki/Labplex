// apps/web/lib/appointmentCounts.ts
import { prisma } from '../lib/db';

// Defensive helper to build where with optional labId
const baseWhere = (labId?: string) =>
	({ isActive: 1, ...(labId ? { labId } : {}) }) as const;

/**
 * Canonical counters for the current Appointment schema.
 * (No reportStatus field; use medicalStatus for all status buckets.)
 */
export async function getAppointmentCounts(labId?: string) {
	const whereBase = baseWhere(labId);

	// Simple totals
	const total = await prisma.appointment.count({ where: whereBase });

	// Status buckets — all via medicalStatus
	const reportReady = await prisma.appointment.count({
		where: { ...whereBase, status: 'REPORT_READY' },
	});
	const closed = await prisma.appointment.count({
		where: { ...whereBase, status: 'CLOSED' },
	});
	const canceled = await prisma.appointment.count({
		where: { ...whereBase, status: 'CANCELED' },
	});

	// Medical pipeline
	const booked = await prisma.appointment.count({
		where: { ...whereBase, status: 'BOOKED' },
	});
	const checkedIn = await prisma.appointment.count({
		where: { ...whereBase, status: 'CHECKED_IN' },
	});
	const sampling = await prisma.appointment.count({
		where: { ...whereBase, status: 'SAMPLING' },
	});
	const processing = await prisma.appointment.count({
		where: { ...whereBase, status: 'PROCESSING' },
	});

	// Example: today’s appointments (local time window)
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
 * Aggregate example
 */
export async function getClosedAggregate(labId?: string) {
	return prisma.appointment.aggregate({
		_count: { _all: true },
		where: { ...baseWhere(labId) },
	});
}
