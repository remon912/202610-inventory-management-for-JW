import { readFile } from 'node:fs/promises';
import { pg } from '../../api/_lib/db.js';
import users from '../../api/users/index.js';
import reports from '../../api/reports.js';

await pg.exec(await readFile('./db/schema.sql', 'utf8'));
await pg.exec(await readFile('./db/seed.sql', 'utf8'));
const { adminLogin } = await import('./harness.js');
const { cookie: ADMIN } = await adminLogin();

async function call(handler, { method = 'GET', query = {}, body } = {}) {
  const res = {
    statusCode: 200,
    setHeader() {},
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(p) {
      this.body = p;
      return this;
    },
  };
  await handler({ method, query, body, url: '/t', headers: { cookie: ADMIN } }, res);
  return { status: res.statusCode, body: res.body };
}
let failures = 0;
const check = (label, cond, extra) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
  if (!cond) {
    failures++;
    console.log('      ', JSON.stringify(extra));
  }
};

// 사용자 추가
let r = await call(users, { method: 'POST', body: { name: '박신입' } });
check(
  'POST /api/users → 201',
  r.status === 201 && r.body.data.name === '박신입' && r.body.data.role === 'member',
  r,
);
r = await call(users, { method: 'POST', body: { name: '박신입' } });
check(
  '같은 이름 다시 추가 → 409 DUPLICATE_USER',
  r.status === 409 && r.body.error.code === 'DUPLICATE_USER',
  r,
);
r = await call(users, { method: 'POST', body: { name: '   ' } });
check('빈 이름 → 400', r.status === 400, r.body);

// 데이터: 한국 시간 기준 날짜가 경계에 걸치도록 구성
const [{ id: uid }] = (await pg.query(`SELECT id FROM users LIMIT 1`)).rows;
await pg.exec(`
  INSERT INTO items (id, name, unit_cost, quantity) VALUES (1, '용지', 1000, 0), (2, '볼펜', 100, 0), (3, '미사용', 5, 0);
  INSERT INTO usage_places (name) VALUES ('영업팀'), ('총무팀');
`);
const mv = async (item, delta, place, at, price = null) =>
  pg.query(
    `INSERT INTO stock_movements (item_id, user_id, delta, usage_place, unit_price, created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
    [item, uid, delta, place, price, at],
  );
await mv(1, 100, '초기 재고', '2026-08-31T10:00:00+09:00'); // 기간 전 (기초)
await mv(1, 50, '한국제지', '2026-09-01T00:30:00+09:00', 900); // 9/1 KST (UTC로는 8/31)
await mv(1, -30, '영업팀', '2026-09-01T23:59:00+09:00', 1500); // 9/1 KST
await mv(1, -10, '총무팀', '2026-09-15T12:00:00+09:00'); // 단가 없음 → 1000
await mv(2, 200, '초기 재고', '2026-09-10T09:00:00+09:00');
await mv(2, -20, '영업팀', '2026-10-02T09:00:00+09:00'); // 10월
await mv(1, -5, '영업팀', '2026-10-01T00:00:00+09:00'); // 기간 밖 (10/1 KST 0시)
await pg.exec(
  `UPDATE items SET quantity = COALESCE((SELECT SUM(delta) FROM stock_movements WHERE item_id = items.id), 0)`,
);

r = await call(reports, {
  query: { from: '2026-09-01', to: '2026-09-30', group: 'day', by: 'item' },
});
check('품목별 9월 → 200', r.status === 200, r.body);
const rows = r.body.data.rows;
const p1 = rows.find((x) => x.itemId === 1);
check(
  '용지: 기초 100, 입고 50, 출고 40, 기말 110',
  p1 && p1.opening === 100 && p1.inQty === 50 && p1.outQty === 40 && p1.closing === 110,
  p1,
);
check(
  '용지 금액: 입고 45,000 / 출고 30×1500+10×1000 = 55,000',
  p1.inAmount === 45000 && p1.outAmount === 55000,
  p1,
);
check(
  '움직임·잔량 없는 품목(미사용)은 제외, 2개 품목',
  rows.length === 2 && !rows.some((x) => x.itemId === 3),
  rows,
);
const b = r.body.data.buckets;
check(
  '일별: 9/1에 입고 50·출고 30 (KST 경계)',
  b.find((x) => x.bucket === '2026-09-01')?.inQty === 50 &&
    b.find((x) => x.bucket === '2026-09-01')?.outQty === 30,
  b,
);
check('일별 묶음 3개 (9/1, 9/10, 9/15)', b.length === 3, b);

r = await call(reports, {
  query: { from: '2026-08-01', to: '2026-10-31', group: 'month', by: 'item', itemId: '1' },
});
check(
  '월별 + 품목 1: 8월·9월·10월',
  r.status === 200 && r.body.data.buckets.map((x) => x.bucket).join() === '2026-08,2026-09,2026-10',
  r.body,
);
check(
  '품목 필터 시 해당 품목만',
  r.body.data.rows.length === 1 && r.body.data.rows[0].opening === 0,
  r.body.data.rows,
);

r = await call(reports, {
  query: { from: '2026-09-01', to: '2026-10-31', group: 'month', by: 'place' },
});
const pr = r.body.data.rows;
check(
  '사용처별: 영업팀(용지 35, 볼펜 20), 총무팀(용지 10)',
  pr.length === 3 &&
    pr
      .filter((x) => x.place === '영업팀')
      .map((x) => x.outQty)
      .sort()
      .join() === '20,35',
  pr,
);
check(
  '사용처별 묶음은 출고만 (입고 0)',
  r.body.data.buckets.every((x) => x.inQty === 0),
  r.body.data.buckets,
);

r = await call(reports, {
  query: {
    from: '2026-09-01',
    to: '2026-10-31',
    group: 'day',
    by: 'place',
    place: '총무팀',
    detail: '1',
  },
});
check(
  '사용처 필터 + 상세내역',
  r.body.data.rows.length === 1 &&
    r.body.data.details.rows.length === 1 &&
    r.body.data.details.rows[0].usagePlace === '총무팀',
  r.body.data,
);

r = await call(reports, { query: { from: '2026-09-30', to: '2026-09-01' } });
check('시작일 > 종료일 → 400', r.status === 400, r.body);
r = await call(reports, { query: { from: '2026-02-30', to: '2026-03-01' } });
check('없는 날짜 → 400', r.status === 400, r.body);
r = await call(reports, { query: { from: '2025-01-01', to: '2026-09-01', group: 'day' } });
check('일별 1년 초과 → 400', r.status === 400, r.body);
r = await call(reports, {
  query: { from: '2025-01-01', to: '2026-09-01', group: 'month', itemId: '' },
});
check('월별 1년 이상 허용, 빈 itemId 허용', r.status === 200, r.body);

console.log(failures ? `\n${failures}건 실패` : '\n전체 통과');
process.exitCode = failures ? 1 : 0;
