'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
	LayoutDashboard, CalendarDays, UserRound, FileText,
	Receipt, Activity, Settings, Users, FlaskConical,
	SlidersHorizontal, ChevronDown, ChevronRight,
	PanelLeftClose, PanelRightClose, Building2, Stethoscope, UserCheck, KeySquare
} from 'lucide-react';
import clsx from 'clsx';
import { useState, useMemo } from 'react';
import { useSession } from 'next-auth/react';

type Role = 'USER' | 'STAFF' | 'ADMIN' | 'SUPER_ADMIN' | string;

const appointmentChildren = [
	{ href: '/appointments/insurance', icon: Building2, label: 'Insurance Vendor' },
	{ href: '/appointments/doctor', icon: Stethoscope, label: 'Doctor Reference' },
	{ href: '/appointments/out-patient', icon: UserCheck, label: 'Out Patient' },
];

const settingsChildrenFull = [
	{ href: '/settings/user', icon: Users, label: 'Manage User' },
	{ href: '/settings/labs', icon: FlaskConical, label: 'Manage Labs' },
	{ href: '/settings/vendors', icon: Building2, label: 'Manage Vendor' },
	{ href: '/settings/config', icon: SlidersHorizontal, label: 'App Configurations' },
];

const settingsChangePasswordOnly = [
	{ href: '/settings/password', icon: KeySquare, label: 'Change Password' },
];

export default function Sidebar({
	open,
	onToggle,
}: {
	open: boolean;
	onToggle: () => void;
}) {
	const pathname = usePathname();
	const { data: session, status } = useSession();

	// Derive role safely from session
	const role: Role = useMemo(() => {
		// adjust these paths if your session stores role elsewhere
		return (
			((session as any)?.user?.role as Role) ||
			((session as any)?.role as Role) ||
			'USER'
		);
	}, [session]);

	const [appointmentsOpen, setAppointmentsOpen] = useState<boolean>(() =>
		pathname.startsWith('/appointments')
	);
	const [settingsOpen, setSettingsOpen] = useState<boolean>(() =>
		pathname.startsWith('/settings')
	);

	const isActive = (href: string) =>
		pathname === href || pathname.startsWith(href + '/');

	// Visibility rules that DO NOT change structure/flow—just hide items as needed.
	const canSeeAppointments = role === 'STAFF' || role === 'ADMIN' || role === 'SUPER_ADMIN';
	const canSeePatients = role === 'STAFF' || role === 'ADMIN' || role === 'SUPER_ADMIN';
	const canSeeBilling = role === 'STAFF' || role === 'ADMIN' || role === 'SUPER_ADMIN';
	const canSeeAnalytics = role === 'STAFF' || role === 'ADMIN' || role === 'SUPER_ADMIN';
	const canSeeSettings = role === 'ADMIN' || role === 'SUPER_ADMIN'; // full settings
	const isPatientUser = role === 'USER';

	// Settings children based on role:
	const settingsChildren = canSeeSettings
		? settingsChildrenFull
		: (isPatientUser ? settingsChangePasswordOnly : []); // staff sees no settings

	return (
		<div className="h-full relative">
			{/* Toggle in the top-right of the sidebar */}
			<button
				onClick={onToggle}
				className="absolute top-2 right-2 inline-flex items-center justify-center rounded-md border px-2.5 py-1.5 text-sm hover:bg-gray-50"
				aria-label="Toggle sidebar"
				title="Toggle sidebar"
			>
				{open ? <PanelLeftClose className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
			</button>

			<nav className="h-full overflow-y-auto pt-10">
				<ul className="p-2 space-y-1">
					{/* Dashboard: show to everyone */}
					<li>
						<Link
							href="/dashboard"
							className={clsx(
								'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
								isActive('/dashboard')
									? 'bg-brand/10 text-brand-600 border border-brand/20'
									: 'hover:bg-gray-50'
							)}
							title={!open ? 'Dashboard' : undefined}
						>
							<LayoutDashboard className="h-4 w-4 shrink-0" />
							{open && <span className="truncate">Dashboard</span>}
						</Link>
					</li>

					{/* Appointments submenu (kept under Dashboard); hidden for patient users */}
					{canSeeAppointments && (
						<li>
							<button
								type="button"
								onClick={() => setAppointmentsOpen((v) => !v)}
								className={clsx(
									'w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
									pathname.startsWith('/appointments')
										? 'bg-brand/10 text-brand-600 border border-brand/20'
										: 'hover:bg-gray-50'
								)}
								title={!open ? 'Appointments' : undefined}
							>
								<span className="flex items-center gap-3">
									<CalendarDays className="h-4 w-4 shrink-0" />
									{open && <span className="truncate">Appointments</span>}
								</span>
								{open &&
									(appointmentsOpen ? (
										<ChevronDown className="h-4 w-4 opacity-70" />
									) : (
										<ChevronRight className="h-4 w-4 opacity-70" />
									))}
							</button>

							{open && (
								<ul
									className={clsx(
										'mt-1 pl-4 space-y-1 overflow-hidden transition-[max-height] duration-300',
										appointmentsOpen ? 'max-h-64' : 'max-h-0'
									)}
								>
									{appointmentChildren.map(({ href, icon: Icon, label }) => {
										const active = isActive(href);
										return (
											<li key={href}>
												<Link
													href={href}
													className={clsx(
														'flex items-center gap-3 rounded-lg px-3 py-2 text-sm',
														active
															? 'bg-brand/10 text-brand-600 border border-brand/20'
															: 'hover:bg-gray-50'
													)}
												>
													<Icon className="h-4 w-4 shrink-0" />
													<span className="truncate">{label}</span>
												</Link>
											</li>
										);
									})}
								</ul>
							)}
						</li>
					)}

					{/* Primary items */}
					{/* Patient Management: hidden for patient users */}
					{canSeePatients && (
						<li>
							<Link
								href="/patients"
								className={clsx(
									'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
									isActive('/patients')
										? 'bg-brand/10 text-brand-600 border border-brand/20'
										: 'hover:bg-gray-50'
								)}
								title={!open ? 'Patient Management' : undefined}
							>
								<UserRound className="h-4 w-4 shrink-0" />
								{open && <span className="truncate">Patient Management</span>}
							</Link>
						</li>
					)}

					{/* Reports: visible to everyone (patients only see this + change password) */}
					<li>
						<Link
							href="/reports"
							className={clsx(
								'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
								isActive('/reports')
									? 'bg-brand/10 text-brand-600 border border-brand/20'
									: 'hover:bg-gray-50'
							)}
							title={!open ? 'Reports' : undefined}
						>
							<FileText className="h-4 w-4 shrink-0" />
							{open && <span className="truncate">Reports</span>}
						</Link>
					</li>

					{/* Billing & Analytics: hidden for patient users */}
					{canSeeBilling && (
						<li>
							<Link
								href="/billing"
								className={clsx(
									'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
									isActive('/billing')
										? 'bg-brand/10 text-brand-600 border border-brand/20'
										: 'hover:bg-gray-50'
								)}
								title={!open ? 'Billing' : undefined}
							>
								<Receipt className="h-4 w-4 shrink-0" />
								{open && <span className="truncate">Billing</span>}
							</Link>
						</li>
					)}

					{canSeeAnalytics && (
						<li>
							<Link
								href="/analytics"
								className={clsx(
									'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
									isActive('/analytics')
										? 'bg-brand/10 text-brand-600 border border-brand/20'
										: 'hover:bg-gray-50'
								)}
								title={!open ? 'Analytics' : undefined}
							>
								<Activity className="h-4 w-4 shrink-0" />
								{open && <span className="truncate">Analytics</span>}
							</Link>
						</li>
					)}

					{/* Settings submenu:
              - ADMIN/SUPER_ADMIN: full settings
              - USER (patient): only Change Password
              - STAFF: hidden
           */}
					{(canSeeSettings || isPatientUser) && (
						<li>
							<button
								type="button"
								onClick={() => setSettingsOpen((v) => !v)}
								className={clsx(
									'w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
									pathname.startsWith('/settings')
										? 'bg-brand/10 text-brand-600 border border-brand/20'
										: 'hover:bg-gray-50'
								)}
								title={!open ? 'Settings' : undefined}
							>
								<span className="flex items-center gap-3">
									<Settings className="h-4 w-4 shrink-0" />
									{open && <span className="truncate">Settings</span>}
								</span>
								{open &&
									(settingsOpen ? (
										<ChevronDown className="h-4 w-4 opacity-70" />
									) : (
										<ChevronRight className="h-4 w-4 opacity-70" />
									))}
							</button>

							{open && (
								<ul
									className={clsx(
										'mt-1 pl-4 space-y-1 overflow-hidden transition-[max-height] duration-300',
										settingsOpen ? 'max-h-64' : 'max-h-0'
									)}
								>
									{settingsChildren.map(({ href, icon: Icon, label }) => {
										const active = isActive(href);
										return (
											<li key={href}>
												<Link
													href={href}
													className={clsx(
														'flex items-center gap-3 rounded-lg px-3 py-2 text-sm',
														active
															? 'bg-brand/10 text-brand-600 border border-brand/20'
															: 'hover:bg-gray-50'
													)}
												>
													<Icon className="h-4 w-4 shrink-0" />
													<span className="truncate">{label}</span>
												</Link>
											</li>
										);
									})}
								</ul>
							)}
						</li>
					)}
				</ul>
			</nav>
		</div>
	);
}
