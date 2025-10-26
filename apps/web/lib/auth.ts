// lib/auth.ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

export const { handlers, auth, signIn, signOut } = NextAuth({
	trustHost: true,
	session: { strategy: "jwt" },
	pages: {
		signIn: "/login",
		error: "/login",
	},
	providers: [
		Credentials({
			name: "Credentials",
			credentials: {
				userId: { label: "User ID", type: "text" },
				password: { label: "Password", type: "password" },
			},
			async authorize(creds) {
				const { userId: rawUserId, password: rawPassword } =
					(creds ?? {}) as { userId?: string; password?: string };

				const userId = (rawUserId ?? "").toString().trim().toUpperCase();
				const password = (rawPassword ?? "").toString();
				if (!userId || !password) throw new Error("Please enter User ID and Password.");

				const user = await prisma.user.findUnique({
					where: { userId },
					select: {
						id: true, userId: true, name: true, role: true, password: true,
						labId: true, lab: { select: { labCode: true, name: true } },
						isActive: true,
					},
				});

				if (!user || user.isActive !== 1) throw new Error("Invalid credentials.");
				const ok = await bcrypt.compare(password, user.password);
				if (!ok) throw new Error("Invalid credentials.");

				return {
					id: user.id,
					userId: user.userId,
					name: user.name,
					role: user.role,
					labId: user.labId,
					labCode: user.lab?.labCode ?? null,
				} as any;
			},
		}),
	],
	callbacks: {
		async jwt({ token, user }) {
			if (user) {
				token.id = (user as any).id;
				token.userId = (user as any).userId;
				token.name = (user as any).name;
				token.role = (user as any).role;
				token.labId = (user as any).labId;
				token.labCode = (user as any).labCode ?? null;
			}
			return token;
		},
		async session({ session, token }) {
			session.user = {
				id: token.id as string,
				userId: token.userId as string,
				name: (token.name as string) ?? null,
				role: (token.role as string) ?? null,
				labId: (token.labId as string) ?? null,
				labCode: (token.labCode as string) ?? null,
			} as any;
			return session;
		},
	},
	debug: process.env.NODE_ENV !== "production",
});
