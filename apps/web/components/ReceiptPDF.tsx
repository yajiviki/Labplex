'use client';

import { PDFDownloadLink, PDFViewer, Page, Text, View, Document, StyleSheet, Font, Image } from '@react-pdf/renderer';
import dayjs from 'dayjs';
import { amountToWordsINR } from '../lib/amountToWords';


// Optional: register a clean font stack (fallback to built-in)
// Font.register({
//   family: 'Inter',
//   fonts: [{ src: '/fonts/Inter-Regular.ttf' }, { src: '/fonts/Inter-Bold.ttf', fontWeight: 'bold' }],
// });

const styles = StyleSheet.create({
	page: { paddingTop: 14, paddingHorizontal: 14, fontSize: 10, fontFamily: 'Helvetica' },
	row: { flexDirection: 'row' },
	cell: { border: 1, borderColor: '#000', padding: 4 },
	bold: { fontWeight: 'bold' },
	title: { textAlign: 'center', fontSize: 14, marginBottom: 6, fontWeight: 'bold' },
	subt: { textAlign: 'center', fontSize: 10, marginBottom: 6 },
	tiny: { fontSize: 8 },
	spacer: { height: 6 },
	logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
	logo: { width: 60, height: 30, marginRight: 8, objectFit: 'contain' },
});

export type ReceiptData = {
	// header
	labName: string;                               // VCL Diagnostics
	labAddress?: string;
	labPhone?: string;
	logoUrl?: string;                              // optional: /logo.png

	// patient / top info
	clientName: string;                            // Mr. Johnson J
	clientMobile?: string;
	age?: string;                                  // "30Y"
	gender?: string;                               // "M" | "F" | "M/30Y" (we will render similar to sample)
	receiptNo: string;                             // "12142"
	apptDateTimeISO: string;                       // appointment or receipt date-time
	referral?: string;                             // TPA name (e.g., "Go Well Next TPA")

	// line item
	testName: string;                              // "Home Visit" or actual test
	testPrice: number;                             // 1000

	// totals
	totalPaidRs: number;                           // 0
	paymentMode?: string;                          // "Due", "Cash", "Online"

	// footer / seal (optional)
	sealPngUrl?: string;                           // /seal.png
};

function block(label: string, value?: string) {
	return (
		<View style={[styles.cell, { flex: 1 }]}>
			<Text><Text style={styles.bold}>{label}</Text> {value ?? ''}</Text>
		</View>
	);
}

export function ReceiptDocument({ data }: { data: ReceiptData }) {
	const dt = dayjs(data.apptDateTimeISO);
	const total = Number(data.testPrice || 0);
	const paid = Number(data.totalPaidRs || 0);
	const balance = Math.max(0, total - paid);
	const words = amountToWordsINR(balance || total);

	const genderAge = [data.gender, data.age].filter(Boolean).join(' / ');
	const payableLine = `Payable Amount (in words): ${words}. (Payment Mode ${data.paymentMode || 'Due'})`;

	return (
		<Document>
			<Page size="A4" style={styles.page}>
				{/* Top branding */}
				<View style={styles.logoRow}>
					{data.logoUrl ? <Image src={data.logoUrl} style={styles.logo} /> : null}
					<View style={{ flex: 1 }}>
						<Text style={styles.title}>{data.labName}</Text>
						{data.labAddress || data.labPhone ? (
							<Text style={styles.subt}>
								{(data.labAddress || '')}{data.labAddress && data.labPhone ? ' | ' : ''}{(data.labPhone || '')}
							</Text>
						) : null}
					</View>
				</View>

				{/* Caption */}
				<View style={[styles.cell, { marginBottom: 4 }]}>
					<Text style={{ textAlign: 'center', fontWeight: 'bold' }}>Receipt</Text>
				</View>

				{/* Name / Gender/Age / Receipt / Date */}
				<View style={[styles.row]}>
					<View style={{ flex: 2 }}>{block('Name :', `${data.clientName}${data.clientMobile ? ' ' + data.clientMobile : ''}`)}</View>
					<View style={{ flex: 1 }}>{block('Gender / Age :', genderAge)}</View>
					<View style={{ flex: 1 }}>{block('Receipt No :', data.receiptNo)}</View>
					<View style={{ flex: 1 }}>{block('Date & Time :', dt.format('DD-MMM-YYYY HH:mm:ss'))}</View>
				</View>

				{/* Referral */}
				<View style={[styles.row]}>
					<View style={{ flex: 1 }}>{block('Referral :', data.referral || '')}</View>
				</View>

				{/* Table header */}
				<View style={[styles.row]}>
					<View style={[styles.cell, { width: 40 }]}><Text style={styles.bold}>S.No</Text></View>
					<View style={[styles.cell, { flex: 1 }]}><Text style={styles.bold}>Test name</Text></View>
					<View style={[styles.cell, { width: 100, textAlign: 'right' as any }]}><Text style={styles.bold}>Test Price</Text></View>
				</View>

				{/* One line item */}
				<View style={[styles.row]}>
					<View style={[styles.cell, { width: 40 }]}><Text>1</Text></View>
					<View style={[styles.cell, { flex: 1 }]}><Text>{data.testName}</Text></View>
					<View style={[styles.cell, { width: 100 }]}>
						<Text style={{ textAlign: 'right' }}>{total.toFixed(2)}</Text>
					</View>
				</View>

				{/* Total */}
				<View style={[styles.row]}>
					<View style={[styles.cell, { flex: 1, textAlign: 'right' as any }]}>
						<Text style={styles.bold}>Total :</Text>
					</View>
					<View style={[styles.cell, { width: 100 }]}>
						<Text style={{ textAlign: 'right' }}>{total.toFixed(2)}</Text>
					</View>
				</View>

				{/* Paid / Balance */}
				<View style={[styles.row]}>
					<View style={[styles.cell, { flex: 1 }]}><Text style={styles.bold}>Total Paid (Rs.)</Text></View>
					<View style={[styles.cell, { width: 100 }]}><Text style={{ textAlign: 'right' }}>{paid.toFixed(2)}</Text></View>
				</View>
				<View style={[styles.row]}>
					<View style={[styles.cell, { flex: 1 }]}><Text style={styles.bold}>Balance Amount (Rs.)</Text></View>
					<View style={[styles.cell, { width: 100 }]}><Text style={{ textAlign: 'right' }}>{balance.toFixed(2)}</Text></View>
				</View>

				{/* Amount in words */}
				<View style={[styles.cell, { marginTop: 4 }]}>
					<Text>{payableLine}</Text>
				</View>

				{/* Seal/Signature row */}
				<View style={{ marginTop: 30, flexDirection: 'row' }}>
					<View style={{ flex: 1 }} />
					<View style={{ width: 180, alignItems: 'center' }}>
						{data.sealPngUrl ? <Image src={data.sealPngUrl} style={{ width: 120, height: 120, opacity: 0.6 }} /> : null}
						<Text style={[styles.tiny, { marginTop: 4 }]}>Signature</Text>
					</View>
				</View>

				{/* Footer address strip */}
				{data.labAddress ? (
					<View style={{ position: 'absolute', bottom: 18, left: 14, right: 14 }}>
						<Text style={[styles.tiny, { textAlign: 'center' }]}>{data.labAddress}</Text>
					</View>
				) : null}
			</Page>
		</Document>
	);
}

export function ReceiptActions({ data, fileName = 'receipt.pdf' }: { data: ReceiptData; fileName?: string }) {
	return (
		<div className="inline-flex items-center gap-2">
			<PDFDownloadLink
				document={<ReceiptDocument data={data} />}
				fileName={fileName}
			>
				{({ loading }) => (
					<button className="border rounded px-3 py-1.5 text-sm">{loading ? 'Preparing…' : 'Download PDF'}</button>
				)}
			</PDFDownloadLink>

			{/* Optional inline viewer for print */}
			{/* Example: show in a modal with <PDFViewer> then window.print() from the modal */}
		</div>
	);
}
