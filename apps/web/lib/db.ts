import { PrismaClient } from '@prisma/client';
export const prisma = new PrismaClient();
// import { PrismaClient } from '@prisma/client';

// declare global {
// 	// eslint-disable-next-line no-var
// 	var prisma: PrismaClient | undefined;
// }

// export const prisma =
// 	global.prisma ??
// 	new PrismaClient({
// 		log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
// 	});

// // (optional) log the DB URL once in dev so we can confirm paths
// if (process.env.NODE_ENV === 'development') {
// 	// Only log once
// 	if (!(global as any).__DB_URL_LOGGED__) {
// 		(global as any).__DB_URL_LOGGED__ = true;
// 		console.log('[Prisma] DATABASE_URL =>', process.env.DATABASE_URL);
// 	}
// }

// if (process.env.NODE_ENV !== 'production') global.prisma = prisma;
