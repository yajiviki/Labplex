import { NextResponse } from 'next/server';
import { auth } from '../../../lib/auth';
import { prisma } from '../../../lib/db';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

function validateNewPassword(pw: string) {
	// tweak as you like
	if (pw.length < 8) return 'Password must be at least 8 characters.';
	if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) {
		return 'Password must include letters and numbers.';
	}
	return null;
}

/**
 * POST /api/change-password
 * Body: { currentPassword: string, newPassword: string, confirmNewPassword: string }
 */
export async function POST(req: Request) {
	try {
		const session = await auth();
		if (!session?.user) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const userId = (session as any).uid || (session as any).user?.id;
		if (!userId) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
		}

		const body = await req.json().catch(() => ({}));
		const currentPassword = String(body?.currentPassword || '');
		const newPassword = String(body?.newPassword || '');

		const policyErr = validateNewPassword(newPassword);
		if (policyErr) return NextResponse.json({ error: policyErr }, { status: 400 });

		// Load user
		const user = await prisma.user.findUnique({
			where: { id: String(userId) },
			select: { id: true, password: true },
		});
		if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

		const stored = user.password || '';
		const isBcrypt = stored.startsWith('$2');
		let ok = false;

		if (isBcrypt) {
			ok = await bcrypt.compare(currentPassword, stored);
		} else {
			// Legacy plaintext fallback
			ok = currentPassword === stored;
		}

		if (!ok) {
			return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 });
		}
		if (isBcrypt && await bcrypt.compare(newPassword, stored)) {
			return NextResponse.json({ error: 'New password must be different from the current password.' }, { status: 400 });
		}

		const newHash = await bcrypt.hash(newPassword, 10);

		await prisma.user.update({
			where: { id: user.id },
			data: {
				password: newHash,
				// Optional audit fields if you have them:
				// passwordUpdatedAt: new Date(),
			},
		});

		return NextResponse.json({ ok: true, message: 'Password updated. Please log in again.' });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Change password failed' }, { status: 500 });
	}
}
