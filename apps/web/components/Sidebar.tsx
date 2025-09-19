'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
	LayoutDashboard, CalendarDays, UserRound, FileText,
	Receipt, Activity, Settings, Users, FlaskConical,
	SlidersHorizontal, ChevronDown, ChevronRight,
	PanelLeftClose, PanelRightClose, Building2, Stethoscope, UserCheck,
} from 'lucide-react';
import clsx from 'clsx';
import { useState } from 'react';

const items = [
	{ href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
	{ href: '/patients', icon: UserRound, label: 'Patients' },
	{ href: '/reports', icon: FileText, label: 'Reports' },
	{ href: '/billing', icon: Receipt, label: 'Billing' },
	{ href: '/analytics', icon: Activity, label: 'Analytics' },
	// Appointments & Settings handled separately for submenus
];

const appointmentChildren = [
	{ href: '/appointments/insurance', icon: Building2, label: 'Insurance Vendor' },
	{ href: '/appointments/doctor', icon: Stethoscope, label: 'Doctor Reference' },
	{ href: '/appointments/out-patient', icon: UserCheck, label: 'Out Patient' },
];

const settingsChildren = [
	{ href: '/settings/staff', icon: Users, label: 'Manage Staff' },
	{ href: '/settings/labs', icon: FlaskConical, label: 'Manage Labs' },
	{ href: '/settings/app', icon: SlidersHorizontal, label: 'App Configurations' },
];

export default function Sidebar({
	open,
	onToggle,
}: {
	open: boolean;
	onToggle: () => void;
}) {
	const pathname = usePathname();
	const [appointmentsOpen, setAppointmentsOpen] = useState<boolean>(() =>
		pathname.startsWith('/appointments')
	);
	const [settingsOpen, setSettingsOpen] = useState<boolean>(() =>
		pathname.startsWith('/settings')
	);

	const isActive = (href: string) =>
		pathname === href || pathname.startsWith(href + '/');

	return (
		<div className="h-full relative">
			{/* Toggle in the top-right of the sidebar */}
			<button
				onClick={onToggle}
				className="absolute top-2 right-2 inline-flex items-center justify-center rounded-md border px-2.5 py-1.5 text-sm hover:bg-gray-50"
				aria-label="Toggle sidebar"
				title="Toggle sidebar"
			>
				{open ? (
					<PanelLeftClose className="h-4 w-4" />
				) : (
					<PanelRightClose className="h-4 w-4" />
				)}
			</button>

			<nav className="h-full overflow-y-auto pt-10">
				<ul className="p-2 space-y-1">
					{/* Primary items */}
					{items.map(({ href, icon: Icon, label }) => {
						const active = isActive(href);
						return (
							<li key={href}>
								<Link
									href={href}
									className={clsx(
										'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
										active
											? 'bg-brand/10 text-brand-600 border border-brand/20'
											: 'hover:bg-gray-50'
									)}
									title={!open ? label : undefined}
								>
									<Icon className="h-4 w-4 shrink-0" />
									{open && <span className="truncate">{label}</span>}
								</Link>
							</li>
						);
					})}

					{/* Appointments with submenu */}
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

					{/* Settings with submenu */}
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
				</ul>
			</nav>
		</div>
	);
}
