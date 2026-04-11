import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COMPLETED_STATUSES = ['Report - Completed', 'Completed'];

const COLORS = {
	labHeaderBg: '1F4E78',
	labHeaderText: 'FFFFFFFF',
	columnHeaderBg: 'D9EAF7',
	columnHeaderText: '1F2937',
	labTotalBg: 'DDEBF7',
	labTotalText: '1F2937',
	grandTotalBg: '1F1F1F',
	grandTotalText: 'FFFFFFFF',
	border: 'BFBFBF',
};

function parseDateFlexible(s?: string) {
	if (!s) return null;

	let m = /^(\d{4})[-/](\d{2})[-/](\d{2})$/.exec(s);
	if (m) return new Date(+m[1], +m[2] - 1, +m[3], 0, 0, 0, 0);

	m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s);
	if (m) return new Date(+m[3], +m[2] - 1, +m[1], 0, 0, 0, 0);

	return null;
}

function endOfDay(d: Date) {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function toNum(v: unknown): number {
	if (v === null || v === undefined) return 0;
	if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
	if (typeof v === 'string') {
		const n = Number(v);
		return Number.isFinite(n) ? n : 0;
	}
	if (typeof v === 'object' && v && typeof (v as any).toNumber === 'function') {
		const n = (v as any).toNumber();
		return typeof n === 'number' && Number.isFinite(n) ? n : 0;
	}
	const n = Number(v as any);
	return Number.isFinite(n) ? n : 0;
}

function normalizeServiceType(s?: string | null): 'Local' | 'Outer' | null {
	const v = (s || '').trim().toLowerCase();
	if (v === 'local' || v === 'l') return 'Local';
	if (v === 'outer' || v === 'o') return 'Outer';
	return null;
}

function getMonthStatementTitle(fromDate: Date) {
	const monthName = fromDate.toLocaleString('en-US', { month: 'long' });
	return `${monthName} - Month Statement`;
}

function safeFileDate(d: Date) {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type GroupRow = {
	labId: string | null;
	vendorId: string | null;
	totalCases: number;
	localCases: number;
	outerCases: number;
	totalTestAmount: number;
	totalExtraCostAmount: number;
};

export async function POST(req: Request) {
	try {
		const { labId, vendorId, from, to } = await req.json();

		const fromDate = parseDateFlexible(from);
		const toStart = parseDateFlexible(to);

		if (!fromDate || !toStart) {
			return NextResponse.json({ error: 'Invalid date range' }, { status: 400 });
		}

		const toDate = endOfDay(toStart);

		const whereBase: any = {
			isActive: 1,
			apptAt: { gte: fromDate, lte: toDate },
			status: { in: COMPLETED_STATUSES },
		};

		if (labId) whereBase.labId = labId;
		if (vendorId) whereBase.vendorId = vendorId;

		const rows = await prisma.appointment.findMany({
			where: whereBase,
			select: {
				labId: true,
				vendorId: true,
				serviceType: true,
				testAmountRs: true,
				extraChargeRs: true,
			},
			orderBy: [{ labId: 'asc' }, { vendorId: 'asc' }],
			take: 500000,
		});

		const keyOf = (labIdVal: string | null, vendorIdVal: string | null) =>
			`${labIdVal ?? ''}__${vendorIdVal ?? ''}`;

		const grouped = new Map<string, GroupRow>();

		for (const row of rows) {
			const key = keyOf(row.labId ?? null, row.vendorId ?? null);

			const cur = grouped.get(key) ?? {
				labId: row.labId ?? null,
				vendorId: row.vendorId ?? null,
				totalCases: 0,
				localCases: 0,
				outerCases: 0,
				totalTestAmount: 0,
				totalExtraCostAmount: 0,
			};

			const serviceType = normalizeServiceType(row.serviceType);

			cur.totalCases += 1;
			if (serviceType === 'Local') cur.localCases += 1;
			if (serviceType === 'Outer') cur.outerCases += 1;

			cur.totalTestAmount += toNum(row.testAmountRs);
			cur.totalExtraCostAmount += toNum(row.extraChargeRs);

			grouped.set(key, cur);
		}

		const groupedRows = Array.from(grouped.values());

		const labIds = Array.from(new Set(groupedRows.map((x) => x.labId).filter(Boolean))) as string[];
		const vendorIds = Array.from(new Set(groupedRows.map((x) => x.vendorId).filter(Boolean))) as string[];

		const [labs, vendors] = await Promise.all([
			labIds.length
				? prisma.lab.findMany({
						where: { id: { in: labIds } },
						select: { id: true, name: true },
				  })
				: Promise.resolve([]),
			vendorIds.length
				? prisma.vendor.findMany({
						where: { id: { in: vendorIds } },
						select: { id: true, tpaName: true },
				  })
				: Promise.resolve([]),
		]);

		const labMap = new Map(labs.map((l) => [l.id, l.name]));
		const vendorMap = new Map(vendors.map((v) => [v.id, v.tpaName]));

		const exportRows = groupedRows
			.map((r) => ({
				labId: r.labId,
				labName: r.labId ? labMap.get(r.labId) || '-' : '—',
				vendorId: r.vendorId,
				tpaName: r.vendorId ? vendorMap.get(r.vendorId) || '-' : '—',
				totalCases: r.totalCases,
				localCases: r.localCases,
				outerCases: r.outerCases,
				totalTestAmount: Number(r.totalTestAmount.toFixed(2)),
				totalExtraCostAmount: Number(r.totalExtraCostAmount.toFixed(2)),
			}))
			.sort(
				(a, b) =>
					a.labName.localeCompare(b.labName) ||
					a.tpaName.localeCompare(b.tpaName)
			);

		const workbook = new ExcelJS.Workbook();
		workbook.creator = 'OpenAI';
		workbook.created = new Date();

		const worksheet = workbook.addWorksheet('Accounts Statement', {
			views: [{ state: 'frozen', ySplit: 3 }],
		});

		const headingTitle = getMonthStatementTitle(fromDate);

		worksheet.mergeCells('A1:F1');
		const titleCell = worksheet.getCell('A1');
		titleCell.value = headingTitle;
		titleCell.font = { bold: true, size: 16, color: { argb: 'FF1F2937' } };
		titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

		worksheet.mergeCells('A2:F2');
		const subTitleCell = worksheet.getCell('A2');
		subTitleCell.value = `From ${safeFileDate(fromDate)} To ${safeFileDate(toDate)}`;
		subTitleCell.font = { italic: true, size: 11, color: { argb: 'FF4B5563' } };
		subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

		worksheet.addRow([]);

		const labsGrouped = new Map<string, typeof exportRows>();
		for (const row of exportRows) {
			const key = row.labName;
			const list = labsGrouped.get(key) ?? [];
			list.push(row);
			labsGrouped.set(key, list);
		}

		let grandTotalCases = 0;
		let grandLocalCases = 0;
		let grandOuterCases = 0;
		let grandTestAmount = 0;
		let grandExtraAmount = 0;

		for (const [labName, labRows] of labsGrouped.entries()) {
			const labHeaderRow = worksheet.addRow(['Lab Name:', labName, '', '', '', '']);
			labHeaderRow.eachCell((cell) => {
				cell.font = { bold: true, color: { argb: COLORS.labHeaderText } };
				cell.fill = {
					type: 'pattern',
					pattern: 'solid',
					fgColor: { argb: COLORS.labHeaderBg },
				};
				cell.border = {
					top: { style: 'thin', color: { argb: COLORS.border } },
					left: { style: 'thin', color: { argb: COLORS.border } },
					bottom: { style: 'thin', color: { argb: COLORS.border } },
					right: { style: 'thin', color: { argb: COLORS.border } },
				};
				cell.alignment = { vertical: 'middle', horizontal: 'left' };
			});

			const headerRow = worksheet.addRow([
				'TPA',
				'Total No of Cases',
				'Total Test Amount (Approx)',
				'Total Local Cases',
				'Total Outer Cases',
				'Total Travel Amount (Approx)',
			]);

			headerRow.eachCell((cell) => {
				cell.font = { bold: true, color: { argb: COLORS.columnHeaderText } };
				cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
				cell.fill = {
					type: 'pattern',
					pattern: 'solid',
					fgColor: { argb: COLORS.columnHeaderBg },
				};
				cell.border = {
					top: { style: 'thin', color: { argb: COLORS.border } },
					left: { style: 'thin', color: { argb: COLORS.border } },
					bottom: { style: 'thin', color: { argb: COLORS.border } },
					right: { style: 'thin', color: { argb: COLORS.border } },
				};
			});

			let labTotalCases = 0;
			let labLocalCases = 0;
			let labOuterCases = 0;
			let labTestAmount = 0;
			let labExtraAmount = 0;

			for (const row of labRows) {
				worksheet.addRow([
					row.tpaName,
					row.totalCases,
					row.totalTestAmount,
					row.localCases,
					row.outerCases,
					row.totalExtraCostAmount,
				]);

				const currentRow = worksheet.lastRow!;
				currentRow.eachCell((cell, colNumber) => {
					cell.border = {
						top: { style: 'thin', color: { argb: COLORS.border } },
						left: { style: 'thin', color: { argb: COLORS.border } },
						bottom: { style: 'thin', color: { argb: COLORS.border } },
						right: { style: 'thin', color: { argb: COLORS.border } },
					};
					cell.alignment = {
						horizontal: colNumber === 1 ? 'left' : 'right',
						vertical: 'middle',
					};
				});

				labTotalCases += row.totalCases;
				labLocalCases += row.localCases;
				labOuterCases += row.outerCases;
				labTestAmount += row.totalTestAmount;
				labExtraAmount += row.totalExtraCostAmount;
			}

			const totalRow = worksheet.addRow([
				'Total',
				labTotalCases,
				Number(labTestAmount.toFixed(2)),
				labLocalCases,
				labOuterCases,
				Number(labExtraAmount.toFixed(2)),
			]);

			totalRow.eachCell((cell, colNumber) => {
				cell.font = { bold: true, color: { argb: COLORS.labTotalText } };
				cell.fill = {
					type: 'pattern',
					pattern: 'solid',
					fgColor: { argb: COLORS.labTotalBg },
				};
				cell.border = {
					top: { style: 'thin', color: { argb: COLORS.border } },
					left: { style: 'thin', color: { argb: COLORS.border } },
					bottom: { style: 'thin', color: { argb: COLORS.border } },
					right: { style: 'thin', color: { argb: COLORS.border } },
				};
				cell.alignment = {
					horizontal: colNumber === 1 ? 'left' : 'right',
					vertical: 'middle',
				};
			});

			worksheet.addRow([]);

			grandTotalCases += labTotalCases;
			grandLocalCases += labLocalCases;
			grandOuterCases += labOuterCases;
			grandTestAmount += labTestAmount;
			grandExtraAmount += labExtraAmount;
		}

		const grandRow = worksheet.addRow([
			'Grand Total',
			grandTotalCases,
			Number(grandTestAmount.toFixed(2)),
			grandLocalCases,
			grandOuterCases,
			Number(grandExtraAmount.toFixed(2)),
		]);

		grandRow.eachCell((cell, colNumber) => {
			cell.font = { bold: true, color: { argb: COLORS.grandTotalText } };
			cell.fill = {
				type: 'pattern',
				pattern: 'solid',
				fgColor: { argb: COLORS.grandTotalBg },
			};
			cell.border = {
				top: { style: 'thin', color: { argb: COLORS.border } },
				left: { style: 'thin', color: { argb: COLORS.border } },
				bottom: { style: 'thin', color: { argb: COLORS.border } },
				right: { style: 'thin', color: { argb: COLORS.border } },
			};
			cell.alignment = {
				horizontal: colNumber === 1 ? 'left' : 'right',
				vertical: 'middle',
			};
		});

		worksheet.columns = [
			{ width: 28 },
			{ width: 18 },
			{ width: 28 },
			{ width: 18 },
			{ width: 18 },
			{ width: 30 },
		];

		for (let i = 1; i <= worksheet.rowCount; i++) {
			worksheet.getRow(i).height = 22;
			worksheet.getCell(`C${i}`).numFmt = '#,##0.00';
			worksheet.getCell(`F${i}`).numFmt = '#,##0.00';
		}

		const buffer = await workbook.xlsx.writeBuffer();
		const fileName = `${headingTitle.replace(/\s+/g, '_')}.xlsx`;

		return new NextResponse(buffer as BodyInit, {
			status: 200,
			headers: {
				'Content-Type':
					'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				'Content-Disposition': `attachment; filename="${fileName}"`,
			},
		});
	} catch (e: any) {
		console.error('[reports/accounts/export] fatal:', e?.message, e?.stack);
		return NextResponse.json(
			{ error: e?.message || 'Server error' },
			{ status: 500 }
		);
	}
}