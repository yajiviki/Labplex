import { auth } from '../../lib/auth';
import { redirect } from 'next/navigation';
import ClientLoginForm from './ClientLoginForm';

export default async function LoginPage() {
	const session = await auth();
	if (session) {
		redirect('/dashboard');
	}
	return <ClientLoginForm />;
}