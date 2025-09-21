// apps/web/scripts/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
	const pw = await bcrypt.hash('demo123', 10);

	// 1) Upsert demo lab (uses labCode, not code)
	const lab = await prisma.lab.upsert({
		where: { labCode: 'LB01' },
		update: {
			name: 'Demo Lab',
			address: '123 Demo Street',
			phone: '0000000000',
			email: null,
			isActive: 1,
		},
		create: {
			labCode: 'LB01',
			name: 'Demo Lab',
			address: '123 Demo Street',
			phone: '0000000000', // required in your schema
			email: null,
			isActive: 1,
		},
	});

	// 2) Upsert a super admin user mapped to this lab
	await prisma.user.upsert({
		where: { employeeId: 'Emp0001' },
		update: {
			name: 'Super Admin',
			phone: '9999999999',
			role: 'SUPER_ADMIN',
			userType: 'STAFF',
			labId: lab.id,
			password: pw,
			isActive: 1,
		},
		create: {
			employeeId: 'Emp0001',
			userType: 'STAFF',
			name: 'Super Admin',
			phone: '9999999999',
			role: 'SUPER_ADMIN',
			email: 'admin@example.com',
			password: pw,
			labId: lab.id,
			isActive: 1,
		},
	});

	console.log('✅ Seed completed.');
}

main()
	.catch((e) => {
		console.error('Seed failed:', e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
