import { NextRequest } from 'next/server';


export function getTenantFromHost(req: NextRequest) {
	const host = req.headers.get('host') || '';
	// e.g., acme.localhost:3000 or acme.example.com → "acme"
	const parts = host.split(':')[0].split('.');
	if (parts.length > 2) return parts[0];
	// fallback to query param for dev: ?lab=demo
	const url = new URL(req.url);
	return url.searchParams.get('lab') || 'demo';
}