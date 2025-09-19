import './globals.css';
import { ReactNode } from 'react';
import { auth } from '../lib/auth';
import Link from 'next/link';

export default async function RootLayout({ children }: { children: ReactNode }) {
	const session = await auth();
	const role = (session as any)?.role as string | undefined;
	const labCode = (session as any)?.labCode as string | undefined;
	return (
		<html lang="en">
			<body className="min-h-screen bg-gray-50 text-gray-900">
				<header className="sticky top-0 z-10 bg-white border-b">
					<div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
						<Link href="/" className="font-semibold">LabPlex {labCode ? `• ${labCode}` : ''}</Link>
						<nav className="flex items-center gap-4 text-sm">
							{role && <Link href="/dashboard">Dashboard</Link>}
							<a href="/api/auth/signout">Sign out</a>
						</nav>
					</div>
				</header>
				<main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
			</body>
		</html>
	);
}