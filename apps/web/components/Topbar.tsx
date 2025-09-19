'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState, useRef, useEffect } from 'react';
import { User, ChevronDown } from 'lucide-react';
import { signOut } from 'next-auth/react';

export default function Topbar({ displayName }: { displayName: string }) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	// close dropdown on outside click
	useEffect(() => {
		function onDocClick(e: MouseEvent) {
			if (!ref.current) return;
			if (!ref.current.contains(e.target as Node)) setOpen(false);
		}
		document.addEventListener('mousedown', onDocClick);
		return () => document.removeEventListener('mousedown', onDocClick);
	}, []);

	return (
		<header className="sticky top-0 z-20 bg-white border-b">
			{/* 👇 remove max-w and px-4 so logo sticks to viewport edge */}
			<div className="w-full h-14 flex items-center justify-between px-3">
				{/* Logo flush left */}
				<Link href="/dashboard" className="flex items-center">
					<Image
						src="/images/Logo.png"
						alt="Company Logo"
						width={130}
						height={130}
						priority
					/>
				</Link>

				{/* User dropdown flush right */}
				<div className="relative" ref={ref}>
					<button
						onClick={() => setOpen((v) => !v)}
						className="flex items-center gap-2 rounded-full border px-3 py-1.5 hover:bg-gray-50"
						aria-label="User menu"
					>
						<User className="h-4 w-4" />
						<span className="hidden sm:inline text-sm text-gray-700">
							Welcome, {displayName}
						</span>
						<ChevronDown className="h-4 w-4" />
					</button>

					{open && (
						<div className="absolute right-0 mt-2 w-44 rounded-md border bg-white shadow-md overflow-hidden">
							<Link
								href="/profile"
								className="block px-3 py-2 text-sm hover:bg-gray-50"
								onClick={() => setOpen(false)}
							>
								Profile
							</Link>
							<Link
								href="/settings"
								className="block px-3 py-2 text-sm hover:bg-gray-50"
								onClick={() => setOpen(false)}
							>
								Settings
							</Link>
							<button
								className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-red-600"
								onClick={async () => {
									setOpen(false);
									await signOut({ callbackUrl: '/login' });
								}}
							>
								Sign out
							</button>
						</div>
					)}
				</div>
			</div>
		</header>
	);
}
