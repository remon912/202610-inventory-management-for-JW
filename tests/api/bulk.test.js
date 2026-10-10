import { readFile } from 'node:fs/promises';
import { pg } from '../../api/_lib/db.js';
import { adminLogin, call, check, done, memberId } from './harness.js';
import bulk from '../../api/items/bulk.js';
import items from '../../api/items/index.js';
import itemPhotos from '../../api/items/[id]/photos.js';

await pg.exec(await readFile('./db/schema.sql', 'utf8'));
await pg.exec(await readFile('./db/seed.sql', 'utf8'));
const { adminId, cookie } = await adminLogin();
const mid = await memberId();

const rows = [
  {
    name: 'A4 용지',
    location: '창고A',
    supplier: '한국제지',
    unitCost: 4500,
    quantity: 10,
    minQuantity: 3,
  },
  { name: '볼펜', unitCost: 350.5 },
  { name: '토너', location: null, supplier: '', unitCost: 89000, quantity: 0 },
];

let r = await call(bulk, { method: 'POST', userId: mid, body: { items: rows } });
check(
  '일반 사용자 일괄 등록 → 401',
  r.status === 401 && r.body.error.code === 'ADMIN_LOGIN_REQUIRED',
  r.body,
);

r = await call(bulk, { method: 'POST', cookie, body: { items: [] } });
check('빈 목록 → 400', r.status === 400, r.body);

r = await call(bulk, {
  method: 'POST',
  cookie,
  body: { items: [rows[0], { name: '', unitCost: -1 }, { name: '테이프', unitCost: 1.234 }] },
});
const fields = r.body.error?.details?.issues?.map((i) => i.field) ?? [];
check(
  '잘못된 줄 → 400, 몇 번째 줄·어느 칸인지 알려줌',
  r.status === 400 &&
    fields.includes('items.1.name') &&
    fields.includes('items.1.unitCost') &&
    fields.includes('items.2.unitCost'),
  fields,
);
let count = (await pg.query('SELECT count(*)::int c FROM items')).rows[0].c;
check('오류가 있으면 하나도 등록되지 않음', count === 0, count);

r = await call(bulk, {
  method: 'POST',
  cookie,
  body: { items: [...rows, { name: ' a4 용지 ', unitCost: 1 }] },
});
check(
  '목록 안 중복 이름(대소문자·공백 무시) → 409',
  r.status === 409 &&
    r.body.error.code === 'DUPLICATE_IN_LIST' &&
    r.body.error.details.rows[0].row === 3,
  r.body,
);

r = await call(bulk, { method: 'POST', cookie, body: { items: rows } });
check('일괄 등록 → 201, 3개', r.status === 201 && r.body.data.count === 3, r.body);
const a4 = r.body.data.items.find((i) => i.name === 'A4 용지');
check(
  '값이 그대로 저장됨 (위치·구입처·단가·수량·기준)',
  a4.location === '창고A' &&
    a4.supplier === '한국제지' &&
    a4.unitCost === 4500 &&
    a4.quantity === 10 &&
    a4.minQuantity === 3,
  a4,
);
const pen = r.body.data.items.find((i) => i.name === '볼펜');
check(
  '생략한 값은 기본값 (수량 0, 기준 0, 빈 구입처 → null)',
  pen.quantity === 0 && pen.minQuantity === 0 && pen.unitCost === 350.5,
  pen,
);
const toner = r.body.data.items.find((i) => i.name === '토너');
check('빈 문자열 구입처 → null', toner.supplier === null && toner.location === null, toner);

const moves = (await pg.query('SELECT item_id, user_id, delta FROM stock_movements')).rows;
check(
  '초기 수량이 있는 품목만 초기 재고 이력 1건 (기록자 = 관리자)',
  moves.length === 1 && moves[0].delta === 10 && moves[0].user_id === adminId,
  moves,
);
const mismatch = (
  await pg.query(`
  SELECT i.id FROM items i LEFT JOIN stock_movements m ON m.item_id = i.id
  GROUP BY i.id HAVING i.quantity <> COALESCE(SUM(m.delta), 0)`)
).rows;
check('보유수량 = 원장 합계', mismatch.length === 0, mismatch);

r = await call(bulk, {
  method: 'POST',
  cookie,
  body: {
    items: [
      { name: '새 품목', unitCost: 1 },
      { name: '볼펜', unitCost: 1 },
    ],
  },
});
check(
  '이미 등록된 품목명 포함 → 409, 해당 줄 표시, 전체 미등록',
  r.status === 409 &&
    r.body.error.code === 'DUPLICATE_ITEMS' &&
    r.body.error.details.rows.length === 1 &&
    r.body.error.details.rows[0].row === 1,
  r.body,
);
count = (await pg.query('SELECT count(*)::int c FROM items')).rows[0].c;
check('(위 요청에서 새 품목도 등록되지 않음)', count === 3, count);

await pg.query(`UPDATE items SET deleted_at = now() WHERE name = '토너'`);
r = await call(bulk, {
  method: 'POST',
  cookie,
  body: { items: [{ name: '토너', unitCost: 90000 }] },
});
check('삭제된 품목과 같은 이름은 다시 등록 가능', r.status === 201, r.body);

const many = Array.from({ length: 501 }, (_, i) => ({ name: `품목${i}`, unitCost: 1 }));
r = await call(bulk, { method: 'POST', cookie, body: { items: many } });
check('501개 → 400 (최대 500개)', r.status === 400, r.body?.error);
r = await call(bulk, { method: 'POST', cookie, body: { items: many.slice(0, 500) } });
check('500개 → 201', r.status === 201 && r.body.data.count === 500, r.body?.error);

r = await call(items, {});
check(
  '목록에서 일괄 등록 품목 조회 (삭제된 1개 제외)',
  r.body.data.length === 503,
  r.body.data.length,
);

// 일괄 등록 직후 화면이 하는 것처럼: 관리자로 등록된 품목에 사진을 한 장씩 올림
const jpeg = (t) =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(t)]).toString('base64');
r = await call(bulk, {
  method: 'POST',
  cookie,
  body: {
    items: [
      { name: '사진품목1', unitCost: 1 },
      { name: '사진품목2', unitCost: 1 },
    ],
  },
});
const created = r.body.data.items;
let okCount = 0;
for (const it of created) {
  const p = await call(itemPhotos, {
    method: 'POST',
    userId: adminId,
    cookie,
    query: { id: String(it.id) },
    body: { photo: { image: jpeg(it.name), thumb: jpeg('t') } },
  });
  if (p.status === 201) okCount++;
}
check('일괄 등록한 품목마다 관리자 세션으로 사진 등록 → 모두 201', okCount === 2, okCount);
r = await call(items, { query: { q: '사진품목' } });
check(
  '목록에 대표 사진 반영',
  r.body.data.length === 2 && r.body.data.every((i) => i.photoId),
  r.body.data,
);
const noSession = await call(itemPhotos, {
  method: 'POST',
  userId: adminId,
  query: { id: String(created[0].id) },
  body: { photo: { image: jpeg('x'), thumb: jpeg('t') } },
});
check(
  '관리자 ID만 있고 로그인 세션 없음 → 사진 등록 401',
  noSession.status === 401,
  noSession.body,
);

done();
