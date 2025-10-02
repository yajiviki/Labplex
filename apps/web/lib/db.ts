// import { PrismaClient } from '@prisma/client';
// export const prisma = new PrismaClient();
// import { PrismaClient } from '@prisma/client';

// const globalForPrisma = global as unknown as { prisma?: PrismaClient };

// export const prisma =
// 	globalForPrisma.prisma ??
// 	new PrismaClient({
// 		log: ['error', 'warn'],
// 	});

// if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
// lib/db.ts
import { PrismaClient } from '@prisma/client';

declare global {
	// eslint-disable-next-line no-var
	var _prisma: PrismaClient | undefined;
}

export const prisma =
	global._prisma ??
	new PrismaClient({
		// optional, handy while debugging
		// log: [{ level: 'query', emit: 'event' }, 'warn', 'error'],
	});

if (process.env.NODE_ENV !== 'production') global._prisma = prisma;

