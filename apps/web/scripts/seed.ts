// apps/web/scripts/seed.ts
import { prisma } from '../lib/db';
import bcrypt from 'bcryptjs';

async function main() {
	const pw = await bcrypt.hash('demo123', 10);

	// Create demo lab
	const lab = await prisma.lab.upsert({
		where: { code: 'demo' },
		update: {},
		create: {
			code: 'demo',
			name: 'Demo Lab',
		},
	});

	// Create admin user with employeeId
	await prisma.user.upsert({
		where: { employeeId: '1001' },
		update: {},
		create: {
			employeeId: '1001',        // 👈 login with this
			email: 'admin@demo.lab',   // optional: still keep email
			name: 'Lab Admin',
			password: pw,
			role: 'LAB_ADMIN',
			labId: lab.id,
			phone: '9876543210',
			dob: new Date('1990-01-01'),
			address: '123 Demo Street',
			userType: 'STAFF', // or 'ADMIN' users keep role as you already set

		},
	});

	// Create staff user with employeeId
	await prisma.user.upsert({
		where: { employeeId: '2001' },
		update: {},
		create: {
			employeeId: '2001',        // 👈 login with this
			email: 'staff@demo.lab',
			name: 'Lab Staff',
			password: pw,
			role: 'STAFF',
			labId: lab.id,
			phone: '9876543210',
			dob: new Date('1990-01-01'),
			address: '123 Demo Street',
			userType: 'STAFF', // or 'ADMIN' users keep role as you already set

		},
	});

	console.log('✅ Seed complete. Login with one of:');
	console.log('- Admin → User ID: 1001 | Password: demo123 | Lab Code: demo');
	console.log('- Staff → User ID: 2001 | Password: demo123 | Lab Code: demo');
}

main().finally(async () => {
	await prisma.$disconnect();
});
