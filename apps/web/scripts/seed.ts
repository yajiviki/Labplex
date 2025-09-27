// apps/web/scripts/seed.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function parseSuffix(id: string | null, prefix: string): number {
	if (!id || !id.startsWith(prefix)) return 0;
	const n = parseInt(id.slice(prefix.length), 10);
	return Number.isFinite(n) ? n : 0;
}

/**
 * Returns next Uxxxx *within a lab* by scanning that lab's users, but also
 * ensures the chosen userId is globally unique (since your schema treats userId as unique).
 */
async function nextUserIdForLab(labId: string): Promise<string> {
	// Highest Uxxxx in THIS lab
	const last = await prisma.user.findFirst({
		where: { labId, userId: { startsWith: 'U' } },
		orderBy: { userId: 'desc' }, // zero-padded U0001.. sorts lexicographically
		select: { userId: true },
	});
	let n = parseSuffix(last?.userId ?? null, 'U');

	// Keep incrementing until we find a userId that is free globally
	while (true) {
		n += 1;
		const candidate = `U${String(n).padStart(4, '0')}`;
		const conflict = await prisma.user.findUnique({
			where: { userId: candidate },
			select: { id: true },
		});
		if (!conflict) return candidate;
	}
}

async function ensureUniqueUserId(desired: string): Promise<string> {
	// If desired is taken globally, bump until free
	let suffix = parseSuffix(desired, 'U');
	let candidate = desired;

	while (true) {
		const conflict = await prisma.user.findUnique({
			where: { userId: candidate },
			select: { id: true },
		});
		if (!conflict) return candidate;
		suffix += 1;
		candidate = `U${String(suffix).padStart(4, '0')}`;
	}
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

	// 2) Ensure an admin in THIS lab
	const adminEmail = 'admin@example.com';

	// We can’t use findUnique on email if email isn’t unique -> use findFirst
	const existingByEmail = await prisma.user.findFirst({
		where: { email: adminEmail },
		select: { id: true, labId: true, userId: true },
	});

	if (existingByEmail) {
		// Move/update the existing user to this lab, ensuring userId is unique globally.
		let targetUserId = existingByEmail.userId;
		if (!targetUserId) {
			targetUserId = await nextUserIdForLab(lab.id);
		} else {
			// Make sure the current userId is globally unique (and if taken by someone else, bump it)
			targetUserId = await ensureUniqueUserId(targetUserId);
		}

		await prisma.user.update({
			where: { id: existingByEmail.id },
			data: {
				labId: lab.id,
				userId: targetUserId,
				name: 'Super Admin',
				phone: '9999999999',
				role: 'SUPER_ADMIN',
				password: pw, // reset for seed
				isActive: 1,
				email: adminEmail,
			},
		});

		console.log(`🔄 Updated admin "${targetUserId}" in lab ${lab.labCode}`);
	} else {
		// No user with that email — create a fresh one in this lab.
		const nextId = await nextUserIdForLab(lab.id);

		// Upsert by userId (unique)
		await prisma.user.upsert({
			where: { userId: nextId },
			update: {
				// Not expected on first run, but harmless for idempotency
				labId: lab.id,
				name: 'Super Admin',
				phone: '9999999999',
				role: 'SUPER_ADMIN',
				password: pw,
				isActive: 1,
				email: adminEmail,
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

		console.log(`✅ Created admin "${nextId}" in lab ${lab.labCode}`);
	}

	console.log('🎉 Seed completed.');
}

main()
	.catch((e) => {
		console.error('Seed failed:', e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
