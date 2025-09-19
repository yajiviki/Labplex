// apps/web/lib/auth.ts
import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './db';

/**
 * Env required:
 * - NEXTAUTH_SECRET (32+ chars)
 * - NEXTAUTH_URL    (e.g., http://localhost:4000)
 * - DATABASE_URL    (e.g., file:./prisma/dev.db)
 *
 * Make sure your Prisma User model has:
 *   employeeId String? @unique
 *   password  String
 *   role      String   @default("STAFF")
 *   labId     String
 */

export const authConfig: NextAuthConfig = {
	providers: [
		Credentials({
			name: 'User ID + Password',
			credentials: {
				employeeId: { label: 'User ID', type: 'text' },
				password: { label: 'Password', type: 'password' },
				labCode: { label: 'Lab Code', type: 'text' },
			},
			authorize: async (creds) => {
				try {
					const employeeId = (creds?.employeeId ?? '').toString().trim();
					const password = (creds?.password ?? '').toString();
					const labCode = (creds?.labCode ?? '').toString().trim();
					if (!employeeId || !password || !labCode) return null;

					// Find lab by code (tenant)
					const lab = await prisma.lab.findUnique({ where: { code: labCode } });
					if (!lab) return null;

					// Find user scoped to this lab by employeeId
					const user = await prisma.user.findFirst({
						where: { employeeId, labId: lab.id },
						select: {
							id: true,
							email: true,
							name: true,
							role: true,
							labId: true,
							employeeId: true,
							password: true,
						},
					});
					if (!user || !user.password) return null;

					// Verify password
					const ok = await bcrypt.compare(password, user.password);
					if (!ok) return null;

					// Return the safe user payload (merged into JWT in callbacks.jwt)
					return {
						id: user.id,
						email: user.email ?? '',
						name: user.name,
						role: user.role,
						labId: user.labId,
						labCode,
						employeeId: user.employeeId ?? '',
					} as any;
				} catch {
					return null;
				}
			},
		}),
	],

	session: { strategy: 'jwt' },

	callbacks: {
		async jwt({ token, user }) {
			// On sign-in, persist custom fields to token
			if (user) {
				token.role = (user as any).role;
				token.labId = (user as any).labId;
				token.labCode = (user as any).labCode;
				token.employeeId = (user as any).employeeId ?? '';
			}
			return token;
		},
		async session({ session, token }) {
			// Expose custom fields on session for server/client usage
			(session as any).role = token.role;
			(session as any).labId = token.labId;
			(session as any).labCode = token.labCode;
			(session as any).employeeId = token.employeeId ?? '';
			return session;
		},
	},
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
