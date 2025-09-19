import { describe, it, expect } from 'vitest';
import { Roles, canViewDashboard, isAdmin } from '../lib/roles';

describe('roles helpers', () => {
	it('allows staff to view dashboard', () => {
		expect(canViewDashboard(Roles.STAFF)).toBe(true);
	});
	it('allows lab admin to be admin', () => {
		expect(isAdmin(Roles.LAB_ADMIN)).toBe(true);
	});
	it('patient cannot view staff dashboard', () => {
		expect(canViewDashboard(Roles.PATIENT)).toBe(false);
	});
	it('org/super admins are admins', () => {
		expect(isAdmin(Roles.ORG_ADMIN)).toBe(true);
		expect(isAdmin(Roles.SUPER_ADMIN)).toBe(true);
	});
});