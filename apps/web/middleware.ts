import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';


const PROTECTED_PREFIXES = ['/dashboard', '/api'];

export async function middleware(req: NextRequest) {
	const { pathname } = new URL(req.url);
	// ✅ Allow NextAuth to do its callbacks (don't guard /api/auth)
	if (pathname.startsWith('/api/auth')) {
		return NextResponse.next();
	}
	// ✅ Allow Next.js internals & public files
	if (
		pathname.startsWith('/_next') ||
		pathname.startsWith('/favicon') ||
		pathname.startsWith('/images') ||
		pathname.startsWith('/api/auth') ||
		pathname === '/'
	) {
		return NextResponse.next();
	}

	const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
	if (!isProtected) return NextResponse.next();

	const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
	if (!token) {
		const url = new URL('/login', req.url);
		url.searchParams.set('next', pathname);
		return NextResponse.redirect(url);
	}
	const res = NextResponse.next();
	res.headers.set('x-lab-id', String((token as any).labId || ''));
	res.headers.set('x-lab-code', String((token as any).labCode || ''));
	return res;
}

export const config = {
	matcher: ['/dashboard/:path*', '/api/:path*']
};
