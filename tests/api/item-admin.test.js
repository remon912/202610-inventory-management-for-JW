import { readFile } from 'node:fs/promises';
import { pg } from '../../api/_lib/db.js';
import { adminLogin, call, check, done, memberId } from './harness.js';
import items from '../../api/items/index.js';
import movements from '../../api/movements.js';
import itemById from '../../api/items/[id].js';

await pg.exec(await readFile('./db/schema.sql', 'utf8'));
await pg.exec(await readFile('./db/seed.sql', 'utf8'));
const { adminId, cookie } = await adminLogin();
const mid = await memberId();
const body = { name: '새 품목', unitCost: 100, quantity: 3 };

let r = await call(items, { method: 'POST', userId: mid, body });
check(
  '일반 사용자 품목 등록 → 401 ADMIN_LOGIN_REQUIRED',
  r.status === 401 && r.body.error.code === 'ADMIN_LOGIN_REQUIRED',
  r.body,
);
r = await call(items, { method: 'POST', userId: adminId, body });
check('관리자 ID만 보내고 로그인 없음 → 401', r.status === 401, r.body);
r = await call(items, { method: 'POST', cookie, body });
check('관리자 로그인 → 201', r.status === 201, r.body);
const id = r.body.data.id;
const [m] = (await pg.query('SELECT user_id, delta FROM stock_movements WHERE item_id=$1', [id]))
  .rows;
check('초기 재고 기록자 = 로그인한 관리자', m.user_id === adminId && m.delta === 3, m);
r = await call(itemById, {
  method: 'PATCH',
  userId: mid,
  query: { id: String(id) },
  body: { unitCost: 120 },
});
check(
  '품목 수정: 일반 사용자 → 401 ADMIN_LOGIN_REQUIRED',
  r.status === 401 && r.body.error.code === 'ADMIN_LOGIN_REQUIRED',
  r.body,
);
r = await call(itemById, {
  method: 'PATCH',
  userId: adminId,
  query: { id: String(id) },
  body: { unitCost: 120 },
});
check('품목 수정: 관리자 ID만 보내고 로그인 없음 → 401', r.status === 401, r.body);
r = await call(itemById, {
  method: 'PATCH',
  cookie,
  query: { id: String(id) },
  body: { unitCost: 120, supplier: '대한상사' },
});
check(
  '품목 수정: 관리자 로그인 → 200',
  r.status === 200 && r.body.data.unitCost === 120 && r.body.data.supplier === '대한상사',
  r.body,
);
r = await call(itemById, { query: { id: String(id) } });
check('품목 조회는 누구나 가능', r.status === 200, r.body);
r = await call(movements, {
  method: 'POST',
  userId: mid,
  body: { itemId: id, delta: 1, usagePlace: 'x' },
});
check('입고는 일반 사용자도 가능 → 201', r.status === 201, r.body);
done();
