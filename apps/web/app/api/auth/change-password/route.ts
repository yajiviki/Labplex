import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { auth } from '../../../../lib/auth';
import { prisma } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

// Accept either top-level (session.id/role) or nested (session.user.id/role)
function getSessionUser(session: any) {
	const id = session?.user?.id ?? session?.id ?? null;
	const role = session?.user?.role ?? session?.role ?? null;
	return { id, role };
}

function canManageAll(role?: string | null) {
	return role === 'SUPER_ADMIN' || role === 'ADMIN';
}

function validateNewPassword(pw: string) {
	// min 8 chars, at least 1 letter + 1 number
	return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(pw);
}

/**
 * POST /api/auth/change-password
 * Body:
 *  - currentPassword (required for normal users changing own password)
 *  - newPassword (required)
 *  - targetUserId (optional; only ADMIN/SUPER_ADMIN can set and then currentPassword is not required)
 */
export async function POST(req: Request) {
	try {
		const session = await auth();
		if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const { id: sessionUserId, role } = getSessionUser(session);
		if (!sessionUserId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

		const { currentPassword, newPassword, targetUserId } = await req.json().catch(() => ({}));

		if (!newPassword) {
			return NextResponse.json({ error: 'newPassword is required' }, { status: 400 });
		}
		if (!validateNewPassword(newPassword)) {
			return NextResponse.json(
				{ error: 'Password must be at least 8 characters and include a letter and a number.' },
				{ status: 400 },
			);
		}

		// Determine which user is being updated
		const userIdToUpdate: string = (targetUserId && canManageAll(role)) ? String(targetUserId) : sessionUserId;

		// Load user
		const user = await prisma.user.findUnique({
			where: { id: userIdToUpdate },
			select: { id: true, password: true },
		});
		if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

		// If admin is changing someone else's password, skip currentPassword check.
		// If changing own password (or not admin), verify currentPassword.
		const changingSomeoneElse = userIdToUpdate !== sessionUserId;
		if (!changingSomeoneElse) {
			if (!currentPassword) {
				return NextResponse.json({ error: 'currentPassword is required' }, { status: 400 });
			}
			const ok = await bcrypt.compare(currentPassword, user.password);
			if (!ok) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
		} else {
			// Only admins can change others
			if (!canManageAll(role)) {
				return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
			}
		}

		// Prevent same password
		const isSame = await bcrypt.compare(newPassword, user.password);
		if (isSame) {
			return NextResponse.json({ error: 'New password must be different from current password' }, { status: 400 });
		}

		const hash = await bcrypt.hash(newPassword, 10);
		await prisma.user.update({
			where: { id: userIdToUpdate },
			data: { password: hash },
		});

		return NextResponse.json({ ok: true, changedUserId: userIdToUpdate });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 });
	}
}
