import { readFile } from 'node:fs/promises';
import { pg } from '../../api/_lib/db.js';
import { adminLogin, call, check, done, memberId } from './harness.js';
import items from '../../api/_routes/items/index.js';
import itemById from '../../api/_routes/items/[id].js';
import itemPhotos from '../../api/_routes/items/[id]/photos.js';
import itemMovements from '../../api/_routes/items/[id]/movements.js';
import photos from '../../api/_routes/photos/[id].js';
import movements from '../../api/_routes/movements.js';

await pg.exec(await readFile('./db/schema.sql', 'utf8'));
await pg.exec(await readFile('./db/seed.sql', 'utf8'));
const { adminId, cookie } = await adminLogin();
const mid = await memberId();
const jpeg = (t) =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(t)]).toString('base64');
const photo = (t) => ({ image: jpeg(t), thumb: jpeg('thumb-' + t) });

// 품목 등록(사진 1) → 입고 사진(사진 2) → 사진 추가(사진 3)
let r = await call(items, {
  method: 'POST',
  cookie,
  body: { name: '볼트', unitCost: 100, quantity: 5, photo: photo('p1') },
});
const itemId = r.body.data.id;
const p1 = r.body.data.photoId;
r = await call(movements, {
  method: 'POST',
  userId: mid,
  body: { itemId, delta: 3, usagePlace: '입고처', photo: photo('p2') },
});
const p2 = r.body.data.movement.photoId;
r = await call(itemPhotos, {
  method: 'POST',
  userId: adminId,
  cookie,
  query: { id: String(itemId) },
  body: { photo: photo('p3') },
});
const p3 = r.body.data.id;
check('(준비) 사진 3장', p1 && p2 && p3, { p1, p2, p3 });

r = await call(photos, { method: 'DELETE', userId: mid, query: { id: String(p3) } });
check(
  '일반 사용자 사진 삭제 → 401',
  r.status === 401 && r.body.error.code === 'ADMIN_LOGIN_REQUIRED',
  r.body,
);
r = await call(photos, { method: 'DELETE', userId: adminId, query: { id: String(p3) } });
check('관리자 ID만, 로그인 세션 없음 → 401', r.status === 401, r.body);

r = await call(photos, { method: 'DELETE', cookie, query: { id: String(p3) } });
check(
  '대표 사진(최신) 삭제 → 200, 다음 대표 = 입고 사진',
  r.status === 200 && r.body.data.photoId === p2,
  r.body,
);
r = await call(itemById, { query: { id: String(itemId) } });
check('품목 대표 사진이 이전 사진으로 바뀜', r.body.data.photoId === p2, r.body.data);
r = await call(photos, { query: { id: String(p3) } });
check('삭제한 사진은 더 이상 열리지 않음 (404)', r.status === 404, r.status);

r = await call(photos, { method: 'DELETE', cookie, query: { id: String(p2) } });
check('입고 때 올린 사진 삭제 → 200', r.status === 200 && r.body.data.photoId === p1, r.body);
r = await call(itemMovements, { query: { id: String(itemId) } });
const inbound = r.body.data.find((m) => m.delta === 3);
check(
  '입고 기록은 그대로, 사진 표시만 사라짐',
  inbound && inbound.photoId === null && r.body.data.length === 2,
  r.body.data,
);
r = await call(itemById, { query: { id: String(itemId) } });
check('보유수량은 그대로 (5 + 3 = 8)', r.body.data.quantity === 8, r.body.data);

r = await call(photos, { method: 'DELETE', cookie, query: { id: String(p1) } });
check(
  '마지막 사진 삭제 → 대표 사진 없음',
  r.status === 200 && r.body.data.photoId === null,
  r.body,
);
r = await call(items, {});
check('목록에서도 사진 없음', r.body.data[0].photoId === null, r.body.data[0]);
r = await call(itemPhotos, { query: { id: String(itemId) } });
check('사진 목록 비어 있음', r.body.data.length === 0, r.body.data);

r = await call(photos, { method: 'DELETE', cookie, query: { id: String(p1) } });
check('이미 삭제한 사진 다시 삭제 → 404', r.status === 404, r.body);
r = await call(photos, { method: 'DELETE', cookie, query: { id: 'abc' } });
check('잘못된 ID → 400', r.status === 400, r.body);

done();
