// 'YYYY-MM-DD' 문자열 기반 날짜 유틸 (브라우저 현지 시간 기준)

const pad = (n) => String(n).padStart(2, '0');
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 'YYYY-MM-DD' → 정오 기준 Date (DST·시간대 경계 영향 없이 날짜 계산) */
const parse = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
};

export const todayStr = () => toDateStr(new Date());

export function daysBetween(from, to) {
  return Math.round((parse(to) - parse(from)) / 86_400_000) + 1;
}

/** 빠른 기간 선택 */
export const PRESETS = [
  { key: 'today', label: '오늘' },
  { key: 'last7', label: '최근 7일' },
  { key: 'thisMonth', label: '이번 달' },
  { key: 'lastMonth', label: '지난달' },
  { key: 'thisYear', label: '올해' },
];

export function presetRange(key, now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const today = toDateStr(now);
  switch (key) {
    case 'today':
      return { from: today, to: today };
    case 'last7':
      return { from: toDateStr(new Date(y, m, now.getDate() - 6)), to: today };
    case 'lastMonth':
      return { from: toDateStr(new Date(y, m - 1, 1)), to: toDateStr(new Date(y, m, 0)) };
    case 'thisYear':
      return { from: `${y}-01-01`, to: today };
    case 'thisMonth':
    default:
      return { from: toDateStr(new Date(y, m, 1)), to: today };
  }
}

/** 기간 내 모든 묶음 키 ('YYYY-MM-DD' 또는 'YYYY-MM') */
export function listBuckets(from, to, group) {
  const out = [];
  if (group === 'month') {
    let [y, m] = from.split('-').map(Number);
    const [ty, tm] = to.split('-').map(Number);
    while (y < ty || (y === ty && m <= tm)) {
      out.push(`${y}-${pad(m)}`);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    return out;
  }
  const end = parse(to);
  for (let d = parse(from); d <= end; d.setDate(d.getDate() + 1)) out.push(toDateStr(d));
  return out;
}

export function formatBucket(bucket, group) {
  if (group === 'month') {
    const [y, m] = bucket.split('-').map(Number);
    return `${y}년 ${m}월`;
  }
  const d = parse(bucket);
  return `${bucket} (${WEEKDAYS[d.getDay()]})`;
}
