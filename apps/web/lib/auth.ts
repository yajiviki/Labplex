// apps/web/lib/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

declare module "next-auth" {
	interface Session {
		user?: {
			id: string;
			name?: string | null;
			role?: string | null;
			labId?: string | null;
			labCode?: string | null;
			userId?: string | null; // U0001…
		} | null;
	}
}

export const { handlers, auth, signIn, signOut } = NextAuth({
	session: { strategy: "jwt" },

	providers: [
		Credentials({
			name: "Credentials",
			credentials: {
				userId: { label: "User ID", type: "text" },
				password: { label: "Password", type: "password" },
				labCode: { label: "Lab Code", type: "text" },
			},
			async authorize(creds) {
				try {
					const userId = (creds?.userId || "").trim();
					const password = String(creds?.password || "");
					const labCode = (creds?.labCode || "").trim();

					if (!userId || !password || !labCode) return null;

					// 1) Find lab by code
					const lab = await prisma.lab.findUnique({
						where: { labCode },
						select: { id: true, labCode: true, name: true },
					});
					if (!lab) return null;

					// 2) Find active user in that lab by userId
					const user = await prisma.user.findFirst({
						where: { labId: lab.id, userId, isActive: 1 },
						select: {
							id: true,
							userId: true,
							name: true,
							role: true,
							password: true,
							labId: true,
						},
					});
					if (!user) return null;

					// 3) Check password
					const ok = await bcrypt.compare(password, user.password);
					if (!ok) return null;

					// 4) Return a minimal object; fields go into JWT then session
					return {
						id: user.id,
						name: user.name ?? user.userId,
						role: user.role,
						labId: user.labId,
						labCode: lab.labCode,
						userId: user.userId,
					} as any;
				} catch {
					return null;
				}
			},
		}),
	],

	callbacks: {
		async jwt({ token, user }) {
			// put fields from authorize() into token
			if (user) {
				token.uid = (user as any).id;
				token.name = (user as any).name;
				token.role = (user as any).role;
				token.labId = (user as any).labId;
				token.labCode = (user as any).labCode;
				token.userId = (user as any).userId;
			}
			return token;
		},
		async session({ session, token }) {
			session.user = {
				id: (token as any).uid,
				name: token.name as any,
				role: (token as any).role,
				labId: (token as any).labId,
				labCode: (token as any).labCode,
				userId: (token as any).userId,
			};
			return session;
		},
	},

	pages: {
		signIn: "/login", // your login route
	},

	trustHost: true,
	secret: process.env.NEXTAUTH_SECRET,
});
