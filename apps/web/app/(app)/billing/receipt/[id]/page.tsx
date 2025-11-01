// page.tsx — Server Component (NO 'use client')
import { notFound } from 'next/navigation';
import { prisma } from '../../../../../lib/db';


export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { id: string } }) {
	return { title: `Receipt #${params.id.slice(0, 8)} • LabPlex` };
}

function fmtINR(n: number) {
	const v = Number(n ?? 0);
	return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function ymdhms(d: Date) {
	return d.toLocaleString('en-IN', { hour12: false });
}

export default async function ReceiptPage({ params }: { params: { id: string } }) {
	const id = params.id;

	const b = await prisma.billing.findUnique({
		where: { id },
		select: {
			id: true,
			paidDate: true,
			amount: true,
			status: true,
			remarks: true,
			createdAt: true,
			lab: { select: { name: true, nickName: true, address: true, phone: true, email: true } },
			vendor: { select: { tpaName: true, nickName: true } },
		},
	});

	if (!b) notFound();

	const total = Number(b.amount ?? 0);
	const paid = b.status === 'Paid' ? total : 0;
	const balance = Math.max(0, total - paid);

	return (
		<div className="print:bg-white">
			{/* Local styles INSIDE body to avoid head mismatch */}
			<style>{`
        :root { --ink:#111; --muted:#555; --line:#dcdcdc; }
        *{ box-sizing:border-box }
        .screenbar{ display:flex; gap:8px; padding:12px; border-bottom:1px solid var(--line); position:sticky; top:0; background:#fff }
        .btn{ border:1px solid var(--line); padding:8px 12px; border-radius:8px; background:#fff; cursor:pointer }
        .container{ margin:16px auto; padding:0 16px; max-width:800px; color:var(--ink); font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial }
        .card{ border:1px solid var(--line); border-radius:12px; overflow:hidden; background:#fff }
        .hdr{ display:flex; justify-content:space-between; padding:16px 20px; border-bottom:1px solid var(--line) }
        .lab{ font-weight:700; font-size:20px }
        .sub{ color:var(--muted); font-size:12px }
        .row{ display:grid; grid-template-columns:1fr 1fr; gap:12px; padding:12px 20px }
        .title{ font-weight:600 }
        table{ width:100%; border-collapse:collapse }
        th,td{ border-top:1px solid var(--line); padding:10px 12px; font-size:14px }
        th{ background:#fafafa; text-align:left }
        .right{ text-align:right }
        .muted{ color:var(--muted) }
        .tot td{ font-weight:700 }
        .foot{ padding:16px 20px; border-top:1px solid var(--line); display:flex; justify-content:space-between; color:var(--muted); font-size:12px }
        @media print{
          .screenbar{ display:none !important }
          @page { size: A4; margin: 12mm }
          body{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

			{/* Screen-only toolbar: plain DOM hooks via script below (no onClick) */}
			<div className="screenbar">
				<button id="btnBack" className="btn" type="button">Back</button>
				<button id="btnPrint" className="btn" type="button">Print / Save as PDF</button>
			</div>

			<div className="container">
				<div className="card">
					<div className="hdr">
						<div>
							<div className="lab">{b.lab.nickName || b.lab.name}</div>
							<div className="sub">
								{[b.lab.address, b.lab.phone, b.lab.email].filter(Boolean).join(' • ')}
							</div>
						</div>
						<div className="sub right">
							<div className="title">Receipt</div>
							<div>ID: {b.id.slice(0, 8)}</div>
							<div>Date: {ymdhms(new Date(b.paidDate ?? b.createdAt))}</div>
						</div>
					</div>

					<div className="row">
						<div>
							<div className="title">Referral (TPA)</div>
							<div>{b.vendor.nickName ? `${b.vendor.tpaName} (${b.vendor.nickName})` : b.vendor.tpaName}</div>
						</div>
						<div>
							<div className="title">Status</div>
							<div>{b.status}</div>
						</div>
					</div>

					<table>
						<thead>
							<tr>
								<th style={{ width: '56px' }}>S.No</th>
								<th>Description</th>
								<th className="right">Amount</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<td>1</td>
								<td>{b.remarks?.trim() ? b.remarks : 'Billing entry'}</td>
								<td className="right">{fmtINR(total)}</td>
							</tr>
						</tbody>
						<tfoot>
							<tr className="tot">
								<td colSpan={2} className="right">Total</td>
								<td className="right">{fmtINR(total)}</td>
							</tr>
							<tr>
								<td colSpan={2} className="right muted">Paid</td>
								<td className="right">{fmtINR(paid)}</td>
							</tr>
							<tr className="tot">
								<td colSpan={2} className="right">Balance</td>
								<td className="right">{fmtINR(balance)}</td>
							</tr>
						</tfoot>
					</table>

					<div className="foot">
						<div>Generated on {ymdhms(new Date(b.createdAt))}</div>
						<div>Powered by LabPlex</div>
					</div>
				</div>
			</div>

			{/* Bind events without React (so we keep this page server-only) */}
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
