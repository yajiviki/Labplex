// apps/web/lib/auth.ts
import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from './db';

/**
 * Env:
 * NEXTAUTH_SECRET, NEXTAUTH_URL, DATABASE_URL
 */
export const authConfig: NextAuthConfig = {
	providers: [
		Credentials({
			name: 'Email + Password',
			credentials: {
				email: { label: 'Email', type: 'email' },
				password: { label: 'Password', type: 'password' },
				labCode: { label: 'Lab Code', type: 'text' },
			},
			authorize: async (creds) => {
				try {
					const email = (creds?.email ?? '').toString().trim();
					const password = (creds?.password ?? '').toString();
					const labCode = (creds?.labCode ?? '').toString().trim();
					if (!email || !password || !labCode) return null;

					const lab = await prisma.lab.findUnique({ where: { code: labCode } });
					if (!lab) return null;

					const user = await prisma.user.findFirst({
						where: { email, labId: lab.id },
						select: { id: true, email: true, name: true, role: true, labId: true, password: true },
					});
					if (!user || !user.password) return null;

					const ok = await bcrypt.compare(password, user.password);
					if (!ok) return null;

					return {
						id: user.id,
						email: user.email ?? '',
						name: user.name,
						role: user.role,
						labId: user.labId,
						labCode,
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
			if (user) {
				token.role = (user as any).role;
				token.labId = (user as any).labId;
				token.labCode = (user as any).labCode;
			}
			return token;
		},
		async session({ session, token }) {
			(session as any).role = token.role;
			(session as any).labId = token.labId;
			(session as any).labCode = token.labCode;
			return session;
		},
	},
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
