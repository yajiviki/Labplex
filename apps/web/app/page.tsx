import Link from 'next/link';
import { auth } from '../lib/auth';
import { redirect } from 'next/navigation';

export default async function Home() {
	const session = await auth();
	if (session) {
		redirect('/dashboard');
	}
	return (
		<div className="max-w-xl space-y-4">
			<h1 className="text-2xl font-bold">Welcome to LabPlex</h1>
			<p className="text-gray-600">Multi-tenant clinical lab platform. Please login to continue.</p>
			<Link href="/login" className="inline-flex items-center px-4 py-2 rounded-md bg-brand text-white">Login</Link>
		</div>
	);
}