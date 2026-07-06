const BELOW_TWENTY = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
] as const;

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'] as const;

function twoDigits(n: number): string {
  if (n < 20) return BELOW_TWENTY[n] ?? '';
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${TENS[tens] ?? ''}${ones ? ` ${BELOW_TWENTY[ones]}` : ''}`.trim();
}

function threeDigits(n: number): string {
  if (n === 0) return '';
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  const hundredPart = hundred ? `${BELOW_TWENTY[hundred]} Hundred` : '';
  const restPart = rest ? twoDigits(rest) : '';
  return [hundredPart, restPart].filter(Boolean).join(' ');
}

function integerToWords(n: number): string {
  if (n === 0) return 'Zero';
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const hundred = n % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/** e.g. 4536 -> "Indian Rupee Four Thousand Five Hundred Thirty-Six Only" */
export function indianRupeesInWords(amount: number): string {
  const safe = Math.max(0, Math.round(amount * 100) / 100);
  const rupees = Math.floor(safe);
  const paise = Math.round((safe - rupees) * 100);
  let words = `Indian Rupee ${integerToWords(rupees)}`;
  if (paise > 0) {
    words += ` and ${integerToWords(paise)} Paise`;
  }
  return `${words} Only`;
}
