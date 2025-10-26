// types/next-auth.d.ts
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
	interface Session {
		user: {
			id: string;
			userId: string;
			name?: string | null;
			role?: string | null;
			labId?: string | null;
			labCode?: string | null;
		} & DefaultSession['user'];
	}
}

declare module 'next-auth/jwt' {
	interface JWT {
		id: string;
		userId: string;
		name?: string;
		role?: string;
		labId?: string;
		labCode?: string | null;
	}
}
