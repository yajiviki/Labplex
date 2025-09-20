export const SOURCES = [
	{ v: 'INSURANCE', label: 'Insurance' },
	{ v: 'DOCTOR', label: 'Doctor Ref.' },
	{ v: 'DIRECT', label: 'Direct Visit' },
	{ v: 'OUTER_LAB', label: 'Outer Lab' },
] as const;

export const VISIT_TYPES = [
	{ v: 'CENTER', label: 'Center Visit' },
	{ v: 'HOME', label: 'Home Visit' },
] as const;

export const STATUSES = [
	'BOOKED', 'CHECKED_IN', 'SAMPLING', 'PROCESSING', 'REPORT_READY', 'CLOSED', 'CANCELED'
] as const;

export type Source = typeof SOURCES[number]['v'];
export type VisitType = typeof VISIT_TYPES[number]['v'];
export type Status = typeof STATUSES[number];
