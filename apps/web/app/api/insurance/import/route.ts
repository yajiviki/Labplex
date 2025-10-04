import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/db';

type IncomingRow = {
	code?: string | null;
	name?: string | null;
	nickName?: string | null; // <— added
	address?: string | null;
	phone?: string | null;
};

function nextCodeFromExisting(existingCodes: string[]): () => string {
	const prefix = 'INS';
	let max = 0;
	for (const c of existingCodes) {
		if (c?.startsWith(prefix)) {
			const n = parseInt(c.slice(prefix.length), 10);
			if (!Number.isNaN(n) && n > max) max = n;
		}
	}
	let cur = max;
	return () => {
		cur += 1;
		return `${prefix}${String(cur).padStart(2, '0')}`;
	};
}

export async function POST(req: Request) {
	try {
		const body = await req.json().catch(() => ({}));
		const rows: IncomingRow[] = Array.isArray(body?.rows) ? body.rows : [];

		if (!rows.length) {
			return NextResponse.json({ error: 'No rows provided', inserted: 0, upserted: 0 }, { status: 400 });
		}

		const existing = await prisma.insuranceCompany.findMany({
			where: { isActive: 1 },
			select: { id: true, code: true, name: true },
		});

		const existingByCode = new Map(
			existing
				.filter(x => x.code)
				.map(x => [String(x.code).toLowerCase(), x]),
		);
		const existingByName = new Map(
			existing.map(x => [x.name.trim().toLowerCase(), x]),
		);

		const getNextCode = nextCodeFromExisting(existing.map(e => e.code || ''));

		let inserted = 0;
		let upserted = 0;
		const errors: Array<{ row: any; error: string }> = [];

		for (const r of rows) {
			const name = (r?.name || '').trim();
			let code = (r?.code || '').trim();
			const nickName = (r?.nickName || '')?.trim() || null; // <— added
			const address = (r?.address || '')?.trim() || null;
			const phone = (r?.phone || '')?.replace(/\D+/g, '') || null;

			if (!name) {
				errors.push({ row: r, error: 'Missing name' });
				continue;
			}

			if (!code) {
				const existsByName = existingByName.get(name.toLowerCase());
				if (existsByName && existsByName.code) {
					code = existsByName.code;
				} else {
					code = getNextCode();
				}
			}

			const codeKey = code.toLowerCase();
			const existingByThisCode = existingByCode.get(codeKey);
			const existingByThisName = existingByName.get(name.toLowerCase());

			if (existingByThisCode) {
				await prisma.insuranceCompany.update({
					where: { id: existingByThisCode.id },
					data: { name, nickName, address, phone, isActive: 1 },
				});
				upserted += 1;
			} else if (existingByThisName) {
				await prisma.insuranceCompany.update({
					where: { id: existingByThisName.id },
					data: { code, nickName, address, phone, isActive: 1 },
				});
				upserted += 1;

				existingByCode.set(codeKey, { id: existingByThisName.id, code, name });
				existingByName.set(name.toLowerCase(), { id: existingByThisName.id, code, name });
			} else {
				const created = await prisma.insuranceCompany.create({
					data: { code, name, nickName, address, phone, isActive: 1 },
					select: { id: true, code: true, name: true },
				});
				inserted += 1;

				existingByCode.set(codeKey, created);
				existingByName.set(name.toLowerCase(), created);
			}
		}

		return NextResponse.json({ ok: true, inserted, upserted, errors });
	} catch (e: any) {
		return NextResponse.json({ error: e?.message || 'Import failed' }, { status: 500 });
	}
}
