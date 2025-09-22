// apps/web/scripts/seed.ts
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function nextUserIdForLab(labId: string): Promise<string> {
	// Find numerically largest Uxxxx for THIS lab and increment
	const last = await prisma.user.findFirst({
		where: { labId, userId: { startsWith: 'U' } },
		orderBy: { userId: 'desc' }, // works with zero-padding
		select: { userId: true },
	});

	const lastN = parseSuffix(last?.userId ?? null, 'U');
	return `U${String(lastN + 1).padStart(4, '0')}`;
}

function parseSuffix(id: string | null, prefix: string): number {
	if (!id || !id.startsWith(prefix)) return 0;
	const n = parseInt(id.slice(prefix.length), 10);
	return Number.isFinite(n) ? n : 0;
}

async function main() {
	const pw = await bcrypt.hash('demo123', 10);

	// 1) Upsert demo lab (by labCode)
	const lab = await prisma.lab.upsert({
		where: { labCode: 'LB01' },
		update: {
			name: 'AG Lab(AG)',
			address: '123 Demo Street',
			phone: '0000000000',
			email: null,
			isActive: 1,
		},
		create: {
			labCode: 'LB01',
			name: 'AG Lab(AG)',
			address: '123 Demo Street',
			phone: '0000000000',
			email: null,
			isActive: 1,
		},
	});

	// 2) Ensure there is exactly one Super Admin with this email in THIS lab
	// Because email is unique globally, we use email to find the user.
	const adminEmail = 'admin@example.com';

	const existingByEmail = await prisma.user.findUnique({
		where: { email: adminEmail },
		select: { id: true, labId: true, userId: true },
	});

	if (existingByEmail) {
		// User with that email already exists somewhere. Update it to match this lab & data.
		// Ensure userId is set and unique within this lab.
		let targetUserId = existingByEmail.userId;
		if (!targetUserId) {
			targetUserId = await nextUserIdForLab(lab.id);
		} else {
			// If the user moves labs, their current userId might collide in the new lab.
			// Check composite uniqueness in target lab and adjust if needed.
			const conflict = await prisma.user.findUnique({
				where: { labId_userId: { labId: lab.id, userId: targetUserId } },
				select: { id: true },
			});
			if (conflict && conflict.id !== existingByEmail.id) {
				targetUserId = await nextUserIdForLab(lab.id);
			}
		}

		await prisma.user.update({
			where: { id: existingByEmail.id },
			data: {
				labId: lab.id,
				userId: targetUserId,
				name: 'Super Admin',
				phone: '9999999999',
				role: 'SUPER_ADMIN',
				password: pw,     // re-assign known password for seed
				isActive: 1,
			},
		});
	} else {
		// No user with that email — create a fresh one in this lab.
		const nextId = await nextUserIdForLab(lab.id);

		// Use composite upsert by (labId, userId) to be future-proof
		await prisma.user.upsert({
			where: { labId_userId: { labId: lab.id, userId: nextId } },
			update: {
				// should not hit update on seed, but kept for idempotency
				name: 'Super Admin',
				phone: '9999999999',
				role: 'SUPER_ADMIN',
				password: pw,
				isActive: 1,
			},
			create: {
				labId: lab.id,
				userId: nextId,
				name: 'Super Admin',
				phone: '9999999999',
				role: 'SUPER_ADMIN',
				email: adminEmail,
				password: pw,
				isActive: 1,
			},
		});
	}

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
