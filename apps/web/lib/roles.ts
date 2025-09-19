export const Roles = {
	PATIENT: 'PATIENT',
	STAFF: 'STAFF',
	LAB_ADMIN: 'LAB_ADMIN',
	ORG_ADMIN: 'ORG_ADMIN',
	SUPER_ADMIN: 'SUPER_ADMIN',
} as const;
export type Role = typeof Roles[keyof typeof Roles];

export function canViewDashboard(role: Role) {
	return role === 'STAFF' || role === 'LAB_ADMIN' || role === 'ORG_ADMIN' || role === 'SUPER_ADMIN';
}

export function isAdmin(role: Role) {
	return role === 'LAB_ADMIN' || role === 'ORG_ADMIN' || role === 'SUPER_ADMIN';
}