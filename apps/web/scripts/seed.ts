import { prisma } from '../lib/db';
import bcrypt from 'bcryptjs';


async function main() {
	const lab = await prisma.lab.upsert({
		where: { code: 'demo' },
		update: {},
		create: { code: 'demo', name: 'Demo Lab' }
	});
	const pw = await bcrypt.hash('demo123', 10);
	await prisma.user.upsert({
		where: { email: 'admin@demo.lab' },
		update: {},
		create: { email: 'admin@demo.lab', employeeId: '1001', name: 'Lab Admin', password: pw, role: 'LAB_ADMIN', labId: lab.id }
	});
	console.log('Seeded demo lab and admin. Login: admin@demo.lab / demo123 (lab code: demo)');
}


main().finally(async () => prisma.$disconnect()); // <-- semicolon present ✅