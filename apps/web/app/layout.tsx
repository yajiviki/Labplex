import './globals.css';
import { ReactNode } from 'react';
import { auth, signOut } from '../lib/auth';
import Link from 'next/link';
import { headers } from 'next/headers';

export default async function RootLayout({ children }: { children: ReactNode }) {
	const session = await auth();
	const pathname = headers().get('x-invoke-path') || '';

	return (
		<html lang="en">
			<body>
				{/* Only show nav if logged in and not on /login */}
				{session && !pathname.startsWith('/login') && (
					<header className="flex justify-between p-4 border-b">
						<Link href="/dashboard" className="font-bold">LabPlex</Link>
						<form action={async () => { 'use server'; await signOut(); }}>
							<button className="text-blue-600">Sign out</button>
						</form>
					</header>
				)}

				<main className="p-4">{children}</main>
			</body>
		</html>
	);
}
