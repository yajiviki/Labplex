import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';


const PROTECTED_PREFIXES = ['/dashboard', '/api'];


export async function middleware(req: NextRequest) {
	const { pathname } = new URL(req.url);
	const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
	if (!isProtected) return NextResponse.next();


	const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
	if (!token) {
		const url = new URL('/login', req.url);
		url.searchParams.set('next', pathname);
		return NextResponse.redirect(url);
	}
	// Optional: attach lab header for API routing
	const res = NextResponse.next();
	res.headers.set('x-lab-id', String((token as any).labId || ''));
	res.headers.set('x-lab-code', String((token as any).labCode || ''));
	return res;
}


export const config = {
	matcher: ['/dashboard/:path*', '/api/:path*']
};