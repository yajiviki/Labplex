// lib/amountToWords.ts
export function amountToWordsINR(num: number) {
	if (!isFinite(num)) return '';
	const a = [
		'', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
		'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
		'Seventeen', 'Eighteen', 'Nineteen'
	];
	const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

	function inWords(n: number): string {
		if (n < 20) return a[n];
		if (n < 100) return `${b[Math.floor(n / 10)]}${n % 10 ? ' ' + a[n % 10] : ''}`.trim();
		if (n < 1000) return `${a[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' + inWords(n % 100) : ''}`.trim();
		if (n < 100000) return `${inWords(Math.floor(n / 1000))} Thousand${n % 1000 ? ' ' + inWords(n % 1000) : ''}`.trim();
		if (n < 10000000) return `${inWords(Math.floor(n / 100000))} Lakh${n % 100000 ? ' ' + inWords(n % 100000) : ''}`.trim();
		return `${inWords(Math.floor(n / 10000000))} Crore${n % 10000000 ? ' ' + inWords(n % 10000000) : ''}`.trim();
	}

	const rupees = Math.floor(num);
	const paise = Math.round((num - rupees) * 100);

	let s = `${inWords(rupees)} Rupees`;
	if (paise > 0) s += ` and ${inWords(paise)} Paise`;
	return s + ' Only';
}
