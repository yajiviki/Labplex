import { NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/db';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COMPLETED_STATUSES = ['Report - Completed', 'Completed'];

const COLORS = {
	titleText: 'FF1F2937',
	subTitleText: 'FF4B5563',
	groupHeaderBg: '1F4E78',
	groupHeaderText: 'FFFFFFFF',
	columnHeaderBg: 'D9EAF7',
	columnHeaderText: 'FF1F2937',
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

function safeFileDate(d: Date) {
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtDate(d?: Date | null) {
	if (!d) return '';
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function normalizeServiceType(s?: string | null) {
	const v = (s || '').trim().toLowerCase();
	if (v === 'local' || v === 'l') return 'Local';
	if (v === 'outer' || v === 'o') return 'Outer';
	return s || '';
}

function applyBorder(cell: ExcelJS.Cell) {
	cell.border = {
		top: { style: 'thin', color: { argb: COLORS.border } },
		left: { style: 'thin', color: { argb: COLORS.border } },
		bottom: { style: 'thin', color: { argb: COLORS.border } },
		right: { style: 'thin', color: { argb: COLORS.border } },
	};
}

type InvoiceRow = {
	apptAt: Date | null;
	proposalId: string;
	clientName: string;
	serviceType: string;
};

type GroupedInvoice = {
	labName: string;
	tpaName: string;
	rows: InvoiceRow[];
};

export async function POST(req: Request) {
	try {
		const body = await req.json().catch(() => ({}));
		const { labId, vendorId, from, to } = body || {};

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
				apptAt: true,
				clientRef: true,
				clientName: true,
				serviceType: true,
				labId: true,
				vendorId: true,
				lab: {
					select: {
						name: true,
					},
				},
				vendor: {
					select: {
						tpaName: true,
					},
				},
			},
			orderBy: [
				{ labId: 'asc' },
				{ vendorId: 'asc' },
				{ apptAt: 'asc' },
				{ clientName: 'asc' },
			],
			take: 500000,
		});

		const groupedMap = new Map<string, GroupedInvoice>();

		rows.forEach((row) => {
			const currentLabName = row.lab?.name ?? '—';
			const currentTpaName = row.vendor?.tpaName ?? '—';
			const key = `${row.labId ?? ''}__${row.vendorId ?? ''}`;

			const current = groupedMap.get(key) ?? {
				labName: currentLabName,
				tpaName: currentTpaName,
				rows: [],
			};

			current.rows.push({
				apptAt: row.apptAt ?? null,
				proposalId: row.clientRef ?? '',
				clientName: row.clientName ?? '',
				serviceType: normalizeServiceType(row.serviceType),
			});

			groupedMap.set(key, current);
		});

		const groupedData = Array.from(groupedMap.values()).sort(
			(a, b) =>
				a.labName.localeCompare(b.labName) ||
				a.tpaName.localeCompare(b.tpaName)
		);

		const workbook = new ExcelJS.Workbook();
		workbook.creator = 'OpenAI';
		workbook.created = new Date();

		const worksheet = workbook.addWorksheet('Invoice Report');

		const totalColumns = 6;

		worksheet.mergeCells(1, 1, 1, totalColumns);
		const titleCell = worksheet.getCell(1, 1);
		titleCell.value = 'Invoice Report -';
		titleCell.font = { bold: true, size: 16, color: { argb: COLORS.titleText } };
		titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

		worksheet.mergeCells(2, 1, 2, totalColumns);
		const subTitleCell = worksheet.getCell(2, 1);
		subTitleCell.value = `From ${safeFileDate(fromDate)} To ${safeFileDate(toDate)}`;
		subTitleCell.font = { italic: true, size: 10, color: { argb: COLORS.subTitleText } };
		subTitleCell.alignment = { horizontal: 'center', vertical: 'middle' };

		let currentRowNumber = 4;

		groupedData.forEach((group) => {
			worksheet.getCell(currentRowNumber, 1).value = 'Lab Name';
			worksheet.getCell(currentRowNumber, 2).value = group.labName;
			worksheet.getCell(currentRowNumber, 4).value = 'TPA Name';
			worksheet.getCell(currentRowNumber, 5).value = group.tpaName;

			worksheet.mergeCells(currentRowNumber, 2, currentRowNumber, 3);
			worksheet.mergeCells(currentRowNumber, 5, currentRowNumber, 6);

			for (let col = 1; col <= totalColumns; col++) {
				const cell = worksheet.getCell(currentRowNumber, col);
				cell.font = { bold: true, color: { argb: COLORS.groupHeaderText } };
				cell.fill = {
					type: 'pattern',
					pattern: 'solid',
					fgColor: { argb: COLORS.groupHeaderBg },
				};
				cell.alignment = { horizontal: 'left', vertical: 'middle' };
				applyBorder(cell);
			}

			currentRowNumber += 1;

			const headers = ['App.Date', 'Proposal ID', '', 'Client Name', '', 'Service Type'];
			headers.forEach((header, index) => {
				worksheet.getCell(currentRowNumber, index + 1).value = header;
			});

			worksheet.mergeCells(currentRowNumber, 2, currentRowNumber, 3);
			worksheet.mergeCells(currentRowNumber, 4, currentRowNumber, 5);

			for (let col = 1; col <= totalColumns; col++) {
				const cell = worksheet.getCell(currentRowNumber, col);
				cell.font = { bold: true, color: { argb: COLORS.columnHeaderText } };
				cell.fill = {
					type: 'pattern',
					pattern: 'solid',
					fgColor: { argb: COLORS.columnHeaderBg },
				};
				cell.alignment = { horizontal: 'center', vertical: 'middle' };
				applyBorder(cell);
			}

			currentRowNumber += 1;

			group.rows.forEach((row) => {
				worksheet.getCell(currentRowNumber, 1).value = fmtDate(row.apptAt);
				worksheet.getCell(currentRowNumber, 2).value = row.proposalId;
				worksheet.getCell(currentRowNumber, 4).value = row.clientName;
				worksheet.getCell(currentRowNumber, 6).value = row.serviceType;

				worksheet.mergeCells(currentRowNumber, 2, currentRowNumber, 3);
				worksheet.mergeCells(currentRowNumber, 4, currentRowNumber, 5);

				for (let col = 1; col <= totalColumns; col++) {
					const cell = worksheet.getCell(currentRowNumber, col);
					cell.alignment = {
						horizontal: col === 1 || col === 6 ? 'center' : 'left',
						vertical: 'middle',
					};
					applyBorder(cell);
				}

				currentRowNumber += 1;
			});

			currentRowNumber += 1;
		});

		worksheet.columns = [
			{ width: 14 },
			{ width: 16 },
			{ width: 14 },
			{ width: 20 },
			{ width: 20 },
			{ width: 15 },
		];

		for (let i = 1; i <= worksheet.rowCount; i++) {
			worksheet.getRow(i).height = 22;
		}

		const buffer = await workbook.xlsx.writeBuffer();
		const fileName = `Invoice_Report_${safeFileDate(fromDate)}_to_${safeFileDate(toDate)}.xlsx`;

		return new NextResponse(buffer as BodyInit, {
			status: 200,
			headers: {
				'Content-Type':
					'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				'Content-Disposition': `attachment; filename="${fileName}"`,
			},
		});
	} catch (e: any) {
		console.error('[reports/accounts/invoice] fatal:', e?.message, e?.stack);
		return NextResponse.json(
			{ error: e?.message || 'Server error' },
			{ status: 500 }
		);
	}
}