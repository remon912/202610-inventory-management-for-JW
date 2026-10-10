import { readFile } from 'node:fs/promises';
import { pg, sqlTag } from '../../api/_lib/db.js';
import items from '../../api/_routes/items/index.js';
import itemById from '../../api/_routes/items/[id].js';
import itemMovements from '../../api/_routes/items/[id]/movements.js';
import movements from '../../api/_routes/movements.js';
import users from '../../api/_routes/users/index.js';
import usagePlaces from '../../api/_routes/usage-places/index.js';
import { recordMovement } from '../../api/_lib/movement.js';

await pg.exec(await readFile('./db/schema.sql', 'utf8'));
await pg.exec(await readFile('./db/seed.sql', 'utf8'));
const { adminLogin } = await import('./harness.js');
const { cookie: ADMIN } = await adminLogin();

async function call(handler, { method = 'GET', query = {}, body, userId, cookie = ADMIN } = {}) {
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(p) {
      this.body = p;
      return this;
    },
  };
  const headers = userId ? { 'x-user-id': userId } : {};
  if (cookie) headers.cookie = cookie;
  const req = { method, query, body, url: '/test', headers };
  await handler(req, res);
  return { status: res.statusCode, body: res.body };
}

let failures = 0;
function check(label, cond, extra) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
  if (!cond) {
    failures++;
    console.log('      ', JSON.stringify(extra));
  }
}

const u = await call(users);
check('GET /api/users → 200, 3명', u.status === 200 && u.body.data.length === 3, u);
const uid = u.body.data.find((x) => x.role === 'member').id;

let r = await call(items, {
  method: 'POST',
  cookie: '',
  body: {
    name: 'A4 용지',
    location: '창고A-선반3',
    unitCost: 4500.5,
    quantity: 10,
    minQuantity: 3,
  },
});
check(
  'POST /api/items 관리자 로그인 없음 → 401',
  r.status === 401 && r.body.error.code === 'ADMIN_LOGIN_REQUIRED',
  r,
);

r = await call(items, {
  method: 'POST',
  userId: uid,
  body: {
    name: 'A4 용지',
    location: '창고A-선반3',
    supplier: '한국제지',
    unitCost: 4500.5,
    quantity: 10,
    minQuantity: 3,
  },
});
check(
  'POST /api/items (구입처 포함) → 201',
  r.status === 201 &&
    r.body.data.quantity === 10 &&
    r.body.data.unitCost === 4500.5 &&
    r.body.data.supplier === '한국제지',
  r,
);
const itemId = r.body.data.id;

r = await call(items, {
  method: 'POST',
  userId: uid,
  body: { name: '볼펜_검정 100%', unitCost: 300, minQuantity: 0 },
});
check(
  'POST /api/items 초기수량 0, 위치 없음 → 201',
  r.status === 201 && r.body.data.location === null && r.body.data.isLow === true,
  r,
);

r = await call(items, { method: 'POST', userId: uid, body: { name: '  ', unitCost: 1.234 } });
check(
  'POST /api/items 잘못된 입력 → 400',
  r.status === 400 && r.body.error.code === 'VALIDATION_ERROR',
  r.body,
);

r = await call(items, { query: { q: 'a4' } });
check('GET /api/items?q=a4 (대소문자 무시) → 1건', r.body.data.length === 1, r.body);
r = await call(items, { query: { q: '100%' } });
check('GET /api/items?q=100% (LIKE 이스케이프) → 1건', r.body.data.length === 1, r.body);
r = await call(items, { query: { q: '%' } });
check('GET /api/items?q=% → % 문자 포함 품목만', r.body.data.length === 1, r.body);
r = await call(items, { query: { location: '창고A-선반3' } });
check('GET /api/items?location= → 1건', r.body.data.length === 1, r.body);
r = await call(items, { query: {} });
check('GET /api/items → 2건', r.body.data.length === 2, r.body);

r = await call(itemById, { query: { id: String(itemId) } });
check('GET /api/items/:id → 200', r.status === 200 && r.body.data.name === 'A4 용지', r);
r = await call(itemById, { query: { id: '99999' } });
check('GET /api/items/99999 → 404', r.status === 404 && r.body.error.code === 'ITEM_NOT_FOUND', r);
r = await call(itemById, { query: { id: 'abc' } });
check('GET /api/items/abc → 400', r.status === 400, r);

r = await call(itemById, {
  method: 'PATCH',
  userId: uid,
  query: { id: String(itemId) },
  body: { unitCost: 4600 },
});
check(
  'PATCH 단가만 → 위치·구입처 유지',
  r.status === 200 &&
    r.body.data.unitCost === 4600 &&
    r.body.data.location === '창고A-선반3' &&
    r.body.data.supplier === '한국제지',
  r,
);
r = await call(itemById, {
  method: 'PATCH',
  userId: uid,
  query: { id: String(itemId) },
  body: { supplier: '대한상사' },
});
check('PATCH 구입처 변경', r.status === 200 && r.body.data.supplier === '대한상사', r);
r = await call(itemById, {
  method: 'PATCH',
  userId: uid,
  query: { id: String(itemId) },
  body: { location: null },
});
check('PATCH location:null → 위치 해제', r.status === 200 && r.body.data.location === null, r);
r = await call(itemById, {
  method: 'PATCH',
  userId: uid,
  query: { id: String(itemId) },
  body: { quantity: 999 },
});
check('PATCH quantity → 400 (보유수량 직접 수정 불가)', r.status === 400, r.body);

r = await call(movements, {
  method: 'POST',
  userId: uid,
  body: { itemId, delta: -5, usagePlace: '3층 회의실' },
});
check(
  '미등록 사용처로 출고 → 400 USAGE_PLACE_NOT_FOUND',
  r.status === 400 && r.body.error.code === 'USAGE_PLACE_NOT_FOUND',
  r.body,
);
r = await call(usagePlaces, { method: 'POST', cookie: '', body: { name: '3층 회의실' } });
check('사용처 추가 관리자 아님 → 401', r.status === 401, r);
r = await call(usagePlaces, { method: 'POST', userId: uid, body: { name: '  3층 회의실 ' } });
check('사용처 추가 → 201 (공백 제거)', r.status === 201 && r.body.data.name === '3층 회의실', r);
const placeId = r.body.data.id;
r = await call(usagePlaces, { method: 'POST', userId: uid, body: { name: '3층 회의실' } });
check('같은 사용처 다시 추가 → 200, 같은 ID', r.status === 200 && r.body.data.id === placeId, r);
r = await call(usagePlaces, { method: 'POST', userId: uid, body: { name: '' } });
check('빈 사용처 → 400', r.status === 400, r.body);
r = await call(usagePlaces);
check('GET /api/usage-places → 1건', r.status === 200 && r.body.data.length === 1, r);
r = await call(movements, {
  method: 'POST',
  userId: uid,
  body: { itemId, delta: 3, usagePlace: '처음 보는 입고처' },
});
check('입고는 사용처 목록 검사 안 함 → 201', r.status === 201, r);
r = await call(movements, {
  method: 'POST',
  userId: uid,
  body: { itemId, delta: -3, usagePlace: '처음 보는 입고처' },
});
check('(위 입고 되돌림용 출고는 미등록이라 거부)', r.status === 400, r.body);
await call(usagePlaces, { method: 'POST', userId: uid, body: { name: '정정' } });
r = await call(movements, {
  method: 'POST',
  userId: uid,
  body: { itemId, delta: -3, usagePlace: '정정' },
});
check('등록된 사용처로 출고 → 201', r.status === 201, r);
r = await call(movements, {
  method: 'POST',
  userId: uid,
  body: { itemId, delta: -5, usagePlace: '3층 회의실', memo: '행사용 출고', unitPrice: 12000 },
});
check(
  'POST /api/movements 출고 -5 → 201, 잔량 5',
  r.status === 201 && r.body.data.item.quantity === 5,
  r,
);
r = await call(movements, {
  method: 'POST',
  userId: uid,
  body: { itemId, delta: -6, usagePlace: '정정' },
});
check(
  '출고 -6 (보유 5) → 409 INSUFFICIENT_STOCK + 현재수량',
  r.status === 409 && r.body.error.details.currentQuantity === 5,
  r,
);
r = await call(movements, {
  method: 'POST',
  userId: uid,
  body: { itemId: 99999, delta: 1, usagePlace: 'x' },
});
check('없는 품목 → 404', r.status === 404, r);
r = await call(movements, {
  method: 'POST',
  userId: uid,
  body: { itemId, delta: 0, usagePlace: 'x' },
});
check('delta 0 → 400', r.status === 400, r.body);
r = await call(movements, {
  method: 'POST',
  userId: uid,
  body: { itemId, delta: 1, usagePlace: 'x', unitPrice: 1.005 },
});
check('단가 소수 3자리 → 400', r.status === 400, r.body);
r = await call(movements, {
  method: 'POST',
  userId: uid,
  body: { itemId, delta: 1000001, usagePlace: 'x' },
});
check('delta 1,000,001 → 400', r.status === 400, r.body);
r = await call(movements, {
  method: 'POST',
  userId: '00000000-0000-0000-0000-000000000000',
  body: { itemId, delta: 1, usagePlace: 'x' },
});
check('없는 사용자 → 401', r.status === 401, r);
r = await call(movements, {
  method: 'POST',
  userId: uid,
  body: { itemId, delta: 3, usagePlace: '○○상사' },
});
check('입고 +3 → 잔량 8', r.status === 201 && r.body.data.item.quantity === 8, r);
r = await call(movements, { method: 'GET' });
check('GET /api/movements → 405', r.status === 405, r);

r = await call(itemMovements, { query: { id: String(itemId) } });
check(
  '이력 최신순 5건 (초기 재고 포함) + 사용자명',
  r.body.data.length === 5 &&
    r.body.data[0].delta === 3 &&
    r.body.data[4].usagePlace === '초기 재고' &&
    r.body.data[0].userName,
  r.body,
);

// 순차 실행이지만 같은 CTE를 대량으로 돌려 마이너스 방지 로직 확인
const results = await Promise.all(
  Array.from({ length: 20 }, () =>
    recordMovement(sqlTag, {
      itemId,
      userId: uid,
      delta: -1,
      usagePlace: 'bulk',
      memo: null,
      unitPrice: null,
    }),
  ),
);
check(
  '-1 출고 20건 (보유 8) → 8 성공 12 거부',
  results.filter((x) => x.status === 'ok').length === 8,
  results.map((x) => x.status),
);

const mismatch = await sqlTag`
  SELECT i.id FROM items i LEFT JOIN stock_movements m ON m.item_id = i.id
  GROUP BY i.id HAVING i.quantity <> COALESCE(SUM(m.delta), 0)`;
check('모든 품목: 보유수량 = 원장 합계', mismatch.length === 0, mismatch);

// 마이그레이션: 001 상태의 기존 DB에 002 적용 → 출고 사용처가 목록으로 옮겨지는지
const { PGlite } = await import('@electric-sql/pglite');
const old = new PGlite();
await old.exec(await readFile('./db/migrations/001_init.sql', 'utf8'));
await old.exec(await readFile('./db/seed.sql', 'utf8'));
await old.exec(`
  INSERT INTO items (name, unit_cost, quantity) VALUES ('x', 0, 5);
  INSERT INTO stock_movements (item_id, user_id, delta, usage_place)
  SELECT 1, id, v.d, v.p FROM users, (VALUES (10, '입고처A'), (-3, '영업팀'), (-2, ' 영업팀 ')) v(d, p) LIMIT 3;`);
await old.exec(await readFile('./db/migrations/002_supplier_usage_places.sql', 'utf8'));
const backfill = (await old.query('SELECT name FROM usage_places')).rows.map((x) => x.name);
check(
  '002 마이그레이션: 출고 사용처만 목록으로 (중복·공백 정리)',
  JSON.stringify(backfill) === '["영업팀"]',
  backfill,
);

console.log(failures ? `\n${failures}건 실패` : '\n전체 통과');
process.exitCode = failures ? 1 : 0;
