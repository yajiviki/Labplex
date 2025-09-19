'use client';

import { useState, ReactNode } from 'react';
import Topbar from './Topbar';
import Sidebar from './Sidebar';

export default function AppShell({
	displayName,
	children,
}: {
	displayName: string;
	children: ReactNode;
}) {
	const [open, setOpen] = useState(true); // sidebar open by default

	return (
		<div className="min-h-screen bg-gray-50 text-gray-900">
			{/* Top bar (logo + user dropdown) */}
			<Topbar displayName={displayName} />

			{/* Sidebar + Content */}
			<div className="relative">
				{/* Fixed left sidebar with toggle in its top-right */}
				<aside
					className={`fixed top-14 left-0 h-[calc(100vh-3.5rem)] ${open ? 'w-64' : 'w-16'
						} transition-all duration-300 ease-in-out border-r bg-white shadow-sm z-10`}
				>
					<Sidebar open={open} onToggle={() => setOpen((v) => !v)} />
				</aside>

				{/* Main content (to the right of sidebar, under topbar) */}
				<main
					className="pt-4 px-4 transition-all duration-300 ease-in-out"
					// avoid Tailwind dynamic class pitfalls
					style={{ marginLeft: open ? 256 : 64 }}
				>
					<div className="mx-auto max-w-7xl">{children}</div>
				</main>
			</div>
		</div>
	);
}
