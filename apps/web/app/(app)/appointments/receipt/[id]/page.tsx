import { notFound } from 'next/navigation';
import { prisma } from '../../../../../lib/db';


export const dynamic = 'force-dynamic';

function fmtINR(n: number) {
	const v = Number(n ?? 0);
	return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function dtLocal(d: Date) {
	return d.toLocaleString('en-IN', { hour12: false });
}
function sexShort(g?: string | null) {
	const s = (g || '').toLowerCase();
	if (s.startsWith('m')) return 'M';
	if (s.startsWith('f')) return 'F';
	return '-';
}
function inWords999(n: number, a: string[]) {
	const b = ['', 'Thousand', 'Lakh', 'Crore'];
	let r = '';
	const u = n % 1000;
	const h = Math.floor(u / 100);
	const t = u % 100;
	if (h) r += a[h] + ' Hundred ';
	if (t) {
		if (t < 20) r += a[t];
		else {
			const d = Math.floor(t / 10);
			const o = t % 10;
			const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
			r += tens[d] + (o ? ' ' + a[o] : '');
		}
	}
	return r.trim();
}
function rupeesInWords(n: number) {
	n = Math.round(n);
	if (n === 0) return 'Zero Rupees Only';
	const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
	const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

	const parts: string[] = [];
	const crore = Math.floor(n / 10000000); n %= 10000000;
	const lakh = Math.floor(n / 100000); n %= 100000;
	const thousand = Math.floor(n / 1000); n %= 1000;
	const rest = n;

	const twoDigit = (x: number) => {
		if (x < 20) return a[x];
		const d = Math.floor(x / 10), o = x % 10;
		return tens[d] + (o ? ' ' + a[o] : '');
	};

	if (crore) parts.push(twoDigit(crore) + ' Crore');
	if (lakh) parts.push(twoDigit(lakh) + ' Lakh');
	if (thousand) parts.push(twoDigit(thousand) + ' Thousand');

	const h = Math.floor(rest / 100);
	const t = rest % 100;
	if (h) parts.push(a[h] + ' Hundred');
	if (t) parts.push(twoDigit(t));

	return (parts.join(' ') + ' Rupees Only').replace(/\s+/g, ' ').trim();
}

export default async function AppointmentReceiptPage({ params }: { params: { id: string } }) {
	const id = params.id;

	const a = await prisma.appointment.findUnique({
		where: { id },
		select: {
			id: true,
			apptAt: true,
			lab: { select: { name: true, nickName: true, address: true, phone: true, email: true } },
			vendor: { select: { tpaName: true, nickName: true } },
			clientName: true,
			clientRef: true,
			gender: true,
			age: true,
			phone: true,
			serviceType: true,
			visitType: true,
			paymentStatus: true,
			extraChargeRs: true,
			createdAt: true,
		},
	});

	if (!a) notFound();

	// Derive fields for the print
	const receiptNo = a.id.slice(0, 8);
	const dt = new Date(a.apptAt ?? a.createdAt);
	const referral = a.vendor
		? (a.vendor.nickName ? `${a.vendor.tpaName} (${a.vendor.nickName})` : a.vendor.tpaName)
		: '-';

	// Choose a description for row
	// Priority: serviceType; else visit label; else "Appointment"
	const visitLabel = a.visitType === 'HOME' ? 'Home Visit' : a.visitType === 'CENTER' ? 'Center Visit' : 'Visit';
	const lineDesc = a.serviceType?.trim() ? a.serviceType : visitLabel;

	const total = Number(a.extraChargeRs ?? 0); // use your field for charge; set via UI
	const paid = a.paymentStatus === 'Paid' ? total : 0;
	const balance = Math.max(0, total - paid);
	const payMode = paid >= total ? 'Paid' : 'Due';
	const amountWords = rupeesInWords(balance || total);

	return (
		<div className="print:bg-white">
			<style>{`
        :root { --ink:#111; --muted:#555; --line:#dcdcdc; }
        *{ box-sizing:border-box }
        .screenbar{ display:flex; gap:8px; padding:12px; border-bottom:1px solid var(--line); position:sticky; top:0; background:#fff }
        .btn{ border:1px solid var(--line); padding:8px 12px; border-radius:8px; background:#fff; cursor:pointer }
        .wrap{ margin:16px auto; padding:0 16px; max-width:900px; color:var(--ink); font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial }
        .card{ border:1px solid var(--line); border-radius:12px; overflow:hidden; background:#fff }
        .hdr{ display:flex; justify-content:space-between; padding:16px 20px; border-bottom:1px solid var(--line) }
        .lab{ font-weight:700; font-size:20px }
        .sub{ color:var(--muted); font-size:12px }
        .grid{ display:grid; grid-template-columns:1fr 1fr; gap:10px 24px; padding:12px 20px }
        .lbl{ font-weight:600; }
        table{ width:100%; border-collapse:collapse }
        th,td{ border-top:1px solid var(--line); padding:10px 12px; font-size:14px }
        th{ background:#fafafa; text-align:left }
        .right{ text-align:right }
        .muted{ color:var(--muted) }
        .tot td{ font-weight:700 }
        .foot{ padding:16px 20px; border-top:1px solid var(--line); display:flex; justify-content:space-between; color:var(--muted); font-size:12px }
        @media print{
          .screenbar{ display:none !important }
          @page { size:A4; margin: 12mm }
          body{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

			<div className="screenbar">
				<button id="btnBack" className="btn" type="button">Back</button>
				<button id="btnPrint" className="btn" type="button">Print / Save as PDF</button>
			</div>

			<div className="wrap">
				<div className="card">
					{/* Header */}
					<div className="hdr">
						<div>
							<div className="lab">{a.lab?.nickName || a.lab?.name || 'Lab'}</div>
							<div className="sub">
								{[a.lab?.address, a.lab?.phone, a.lab?.email].filter(Boolean).join(' • ')}
							</div>
						</div>
						<div className="sub right">
							<div className="lbl">Receipt</div>
							<div>Receipt No : <b>{receiptNo}</b></div>
							<div>Date &amp; Time : {dtLocal(dt)}</div>
						</div>
					</div>

					{/* Patient / meta rows */}
					<div className="grid">
						<div>
							<div className="lbl">Name</div>
							<div>
								{(a.clientName || '-')}
								{/* {a.phone ? `  ${a.phone}` : ''} */}
								{a.clientRef ? `  [ No : ${a.clientRef} ]` : ''}
							</div>
						</div>
						<div>
							<div className="lbl">Gender / Age</div>
							<div>
								{sexShort(a.gender)} / {a.age != null ? `${a.age}Y` : '-'}
							</div>
						</div>
						<div>
							<div className="lbl">Referral</div>
							<div>{referral || '-'}</div>
						</div>
						<div>
							<div className="lbl">Visit</div>
							<div>{visitLabel}</div>
						</div>
					</div>

					{/* Items */}
					<table>
						<thead>
							<tr>
								<th style={{ width: '64px' }}>S.No</th>
								<th>Test name</th>
								<th className="right">Test Price</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td>1</td>
								<td>{lineDesc}</td>
								<td className="right">{fmtINR(total)}</td>
							</tr>
						</tbody>
						<tfoot>
							<tr className="tot">
								<td colSpan={2} className="right">Total :</td>
								<td className="right">{fmtINR(total)}</td>
							</tr>
							<tr>
								<td colSpan={2} className="right muted">Total Paid (Rs.)</td>
								<td className="right">{fmtINR(paid)}</td>
							</tr>
							<tr className="tot">
								<td colSpan={2} className="right">Balance Amount (Rs.)</td>
								<td className="right">{fmtINR(balance)}</td>
							</tr>
						</tfoot>
					</table>

					<div style={{ paddingTop: 0, paddingLeft: 10 }}>
						<div className="lbl">Payable Amount (in words) : </div>
						<div>{amountWords}. (Payment Mode {payMode})</div>
					</div>

					<div className="foot">
						<div>Generated on {dtLocal(new Date(a.createdAt))}</div>
						<div>Powered by LabPlex</div>
					</div>
				</div>
			</div>

			<script
				dangerouslySetInnerHTML={{
					__html: `
            (function(){
              try {
                var u = new URL(location.href);
                if (u.searchParams.get('print') === '1') { window.print(); }
              } catch (e) {}
              var back = document.getElementById('btnBack');
              var printBtn = document.getElementById('btnPrint');
              if (back) back.addEventListener('click', function(){ history.back(); });
              if (printBtn) printBtn.addEventListener('click', function(){ window.print(); });
            })();
          `,
				}}
			/>
		</div>
	);
}
