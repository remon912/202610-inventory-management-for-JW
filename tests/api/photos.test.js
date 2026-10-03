import { readFile } from 'node:fs/promises';
import { pg } from '../../api/_lib/db.js';
import items from '../../api/items/index.js';
import itemById from '../../api/items/[id].js';
import itemMovements from '../../api/items/[id]/movements.js';
import itemPhotos from '../../api/items/[id]/photos.js';
import photos from '../../api/photos/[id].js';
import movements from '../../api/movements.js';
import usagePlaces from '../../api/usage-places/index.js';

await pg.exec(await readFile('./db/schema.sql', 'utf8'));
await pg.exec(await readFile('./db/seed.sql', 'utf8'));
const [{ id: uid }] = (await pg.query(`SELECT id FROM users WHERE role = 'member' LIMIT 1`)).rows;
const { adminLogin } = await import('./harness.js');
const { cookie: ADMIN } = await adminLogin();

async function call(handler, { method = 'GET', query = {}, body } = {}) {
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k.toLowerCase()] = v;
    },
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(p) {
      this.body = p;
      return this;
    },
    end(buf) {
      this.raw = buf;
      return this;
    },
  };
  await handler(
    { method, query, body, url: '/t', headers: { 'x-user-id': uid, cookie: ADMIN } },
    res,
  );
  return res;
}
let failures = 0;
const check = (label, cond, extra) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
  if (!cond) {
    failures++;
    console.log('      ', JSON.stringify(extra)?.slice(0, 400));
  }
};

const jpeg = (tag) =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(tag)]).toString('base64');
const photo = { image: jpeg('full-image-bytes'), thumb: jpeg('thumb') };

let r = await call(items, {
  method: 'POST',
  body: { name: '사진 품목', unitCost: 100, quantity: 5, photo },
});
check(
  '사진과 함께 품목 등록 → 201, photoId',
  r.statusCode === 201 && r.body.data.photoId > 0,
  r.body,
);
const itemId = r.body.data.id;
const firstPhoto = r.body.data.photoId;

r = await call(items, { method: 'POST', body: { name: '사진 없음', unitCost: 100 } });
check(
  '사진 없이 등록 → photoId null',
  r.statusCode === 201 && r.body.data.photoId === null,
  r.body,
);

r = await call(items, {
  method: 'POST',
  body: {
    name: 'PNG',
    unitCost: 1,
    photo: { image: Buffer.from('\x89PNG....').toString('base64'), thumb: photo.thumb },
  },
});
check('JPEG가 아닌 사진 → 400', r.statusCode === 400, r.body);
r = await call(items, {
  method: 'POST',
  body: {
    name: '큼',
    unitCost: 1,
    photo: { image: '/9j/' + 'A'.repeat(3_000_000), thumb: photo.thumb },
  },
});
check('용량 초과 → 400', r.statusCode === 400, r.body?.error);

r = await call(photos, { query: { id: String(firstPhoto) } });
check(
  '원본 사진 반환 (image/jpeg, 캐시)',
  r.statusCode === 200 &&
    r.headers['content-type'] === 'image/jpeg' &&
    r.raw.toString('latin1').includes('full-image-bytes') &&
    r.headers['cache-control'].includes('immutable'),
  r.headers,
);
r = await call(photos, { query: { id: String(firstPhoto), size: 'thumb' } });
check(
  '미리보기 사진 반환',
  r.statusCode === 200 && r.raw.toString('latin1').includes('thumb'),
  r.headers,
);
r = await call(photos, { query: { id: '9999' } });
check(
  '없는 사진 → 404 JSON',
  r.statusCode === 404 && r.body.error.code === 'PHOTO_NOT_FOUND',
  r.body,
);

r = await call(itemById, { method: 'PATCH', query: { id: String(itemId) }, body: { photo } });
check('품목 수정으로 사진 등록 불가 → 400', r.statusCode === 400, r.body);

r = await call(movements, {
  method: 'POST',
  body: {
    itemId,
    delta: 3,
    usagePlace: '입고처',
    photo: { image: jpeg('inbound'), thumb: jpeg('t2') },
  },
});
check(
  '입고와 함께 사진 → 201, movement.photoId',
  r.statusCode === 201 && r.body.data.movement.photoId > firstPhoto,
  r.body,
);
const inboundPhoto = r.body.data.movement.photoId;

await call(usagePlaces, { method: 'POST', body: { name: '영업팀' } });
r = await call(movements, {
  method: 'POST',
  body: { itemId, delta: -1, usagePlace: '영업팀', photo },
});
check(
  '출고에 사진 → 400 (입고만 허용)',
  r.statusCode === 400 && r.body.error.message.includes('입고'),
  r.body,
);
const cnt = (
  await pg.query(`SELECT count(*)::int AS c FROM stock_movements WHERE item_id = $1`, [itemId])
).rows[0].c;
check('거부된 출고는 이력에 남지 않음 (초기 + 입고 = 2건)', cnt === 2, cnt);

r = await call(itemById, { query: { id: String(itemId) } });
check(
  '품목 상세 photoId = 최신 사진(입고 사진)',
  r.body.data.photoId === inboundPhoto,
  r.body.data,
);
r = await call(items, { query: { q: '사진' } });
check(
  '목록에도 최신 photoId',
  r.body.data.find((i) => i.id === itemId)?.photoId === inboundPhoto,
  r.body.data,
);
r = await call(itemMovements, { query: { id: String(itemId) } });
check(
  '이력: 입고 기록에 photoId, 초기재고 기록은 null',
  r.body.data[0].photoId === inboundPhoto && r.body.data[1].photoId === null,
  r.body.data,
);
r = await call(itemPhotos, { query: { id: String(itemId) } });
check(
  '품목 사진 목록 최신순 2장',
  r.body.data.length === 2 &&
    r.body.data[0].id === inboundPhoto &&
    r.body.data[0].movementId !== null &&
    r.body.data[1].movementId === null,
  r.body.data,
);
r = await call(itemById, {
  method: 'PATCH',
  query: { id: String(itemId) },
  body: { unitCost: 200 },
});
check(
  '품목 수정 후에도 photoId 유지',
  r.statusCode === 200 && r.body.data.photoId === inboundPhoto,
  r.body.data,
);

console.log(failures ? `\n${failures}건 실패` : '\n전체 통과');
process.exitCode = failures ? 1 : 0;

// ── 기존 품목 사진 등록·변경 (POST /api/items/:id/photos) ──
{
  const before = (await call(itemById, { query: { id: String(itemId) } })).body.data.photoId;
  let r2 = await call(itemPhotos, {
    method: 'POST',
    query: { id: String(itemId) },
    body: { photo: { image: jpeg('changed'), thumb: jpeg('t3') } },
  });
  check('기존 품목 사진 변경 → 201', r2.statusCode === 201 && r2.body.data.id > before, r2.body);
  const after = (await call(itemById, { query: { id: String(itemId) } })).body.data.photoId;
  check('대표 사진이 새 사진으로 바뀜', after === r2.body.data.id, { before, after });
  r2 = await call(itemPhotos, { query: { id: String(itemId) } });
  check('이전 사진은 보존 (3장)', r2.body.data.length === 3, r2.body.data);
  r2 = await call(itemPhotos, { method: 'POST', query: { id: String(itemId) }, body: {} });
  check('사진 없이 요청 → 400', r2.statusCode === 400, r2.body);
  r2 = await call(itemPhotos, { method: 'POST', query: { id: '9999' }, body: { photo } });
  check('없는 품목 → 404', r2.statusCode === 404, r2.body);
  const res = {
    statusCode: 200,
    headers: {},
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
  await itemPhotos(
    { method: 'POST', query: { id: String(itemId) }, body: { photo }, url: '/t', headers: {} },
    res,
  );
  check('사용자 선택 없이 → 401', res.statusCode === 401, res.body);
  done2();
}
function done2() {
  console.log(failures ? `\n${failures}건 실패` : '\n전체 통과 (사진 변경 포함)');
  process.exitCode = failures ? 1 : 0;
}
