import { PrismaClient } from '@prisma/client';

function zeroPad(n: number, width = 4) {
	const s = String(n);
	return s.length >= width ? s : '0'.repeat(width - s.length) + s;
}

/**
 * Allocate the next unique userId like "USR0001", "USR0002", ...
 * You can change the prefix to include labCode, e.g. `${labCode}-USR`.
 */
export async function allocateNextUserId(prisma: PrismaClient, prefix = 'USR') {
	// find latest by lexicographic order (works with fixed width numbers)
	const last = await prisma.user.findFirst({
		where: { userId: { startsWith: prefix } },
		orderBy: { userId: 'desc' },
		select: { userId: true },
	});

	let nextNum = 1;
	if (last?.userId) {
		const m = last.userId.match(/(\d+)$/);
		if (m) nextNum = parseInt(m[1], 10) + 1;
	}
	return `${prefix}${zeroPad(nextNum)}`;
}
