const numberFmt = new Intl.NumberFormat('ko-KR');
const moneyFmt = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 });
const dateTimeFmt = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
const timeFmt = new Intl.DateTimeFormat('ko-KR', { timeStyle: 'medium' });

export const formatNumber = (n) => numberFmt.format(n);

export const formatWon = (n) => (n === null || n === undefined ? '—' : `${moneyFmt.format(n)}원`);

export const formatDateTime = (iso) => dateTimeFmt.format(new Date(iso));

export const formatTime = (ms) => timeFmt.format(new Date(ms));

/** 입고는 +, 출고는 − (U+2212) 기호를 붙인다 */
export const formatDelta = (d) => `${d > 0 ? '+' : '−'}${numberFmt.format(Math.abs(d))}`;

/** 쉼표를 허용하는 정수 입력 파싱. 형식이 틀리면 NaN */
export function parseIntInput(s) {
  const v = String(s).replace(/,/g, '').trim();
  return /^\d+$/.test(v) ? Number(v) : NaN;
}

/** 소수점 2자리까지 허용하는 금액 입력 파싱. 빈 값은 null, 형식이 틀리면 NaN */
export function parseMoneyInput(s) {
  const v = String(s).replace(/,/g, '').trim();
  if (v === '') return null;
  return /^\d+(\.\d{1,2})?$/.test(v) ? Number(v) : NaN;
}
