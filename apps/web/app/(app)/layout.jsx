// apps/web/app/(app)/layout.jsx
import { auth } from '../../lib/auth';
import AppShell from '../../components/AppShell';

export default async function AppLayout({ children }) {
	const session = await auth();

	const displayName =
		session?.employeeId ||
		session?.name ||
		session?.user?.name ||
		session?.user?.email ||
		'User';

	return <AppShell displayName={displayName}>{children}</AppShell>;
}
