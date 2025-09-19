import NextAuth, { type NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from './db';
import bcrypt from 'bcryptjs';


export const authConfig: NextAuthConfig = {
	providers: [
		Credentials({
			name: 'Email & Password',
			credentials: {
				email: { label: 'Email', type: 'email' },
				password: { label: 'Password', type: 'password' },
				labCode: { label: 'Lab Code', type: 'text' }
			},
			authorize: async (creds) => {
				if (!creds?.email || !creds?.password || !creds?.labCode) return null;
				const lab = await prisma.lab.findUnique({ where: { code: creds.labCode } });
				if (!lab) return null;
				const user = await prisma.user.findUnique({ where: { email: creds.email } });
				if (!user || user.labId !== lab.id) return null;
				const ok = await bcrypt.compare(creds.password, user.password);
				if (!ok) return null;
				return { id: user.id, email: user.email, name: user.name, role: user.role, labId: user.labId, labCode: lab.code } as any;
			}
		})
	],
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
		}
	},
	session: { strategy: 'jwt' }
};


export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);