// 배포 진입점(api/router.js): Vercel이 /api/* 를 /api/router?__path=* 로 넘겨줄 때와
// 원래 주소가 그대로 올 때 모두 올바른 처리 함수로 가는지 확인한다.
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { pg } from '../../api/_lib/db.js';
import { adminLogin, check, done } from './harness.js';
import router from '../../api/router.js';
import { ROUTES } from '../../api/_lib/router.js';

await pg.exec(await readFile('./db/schema.sql', 'utf8'));
await pg.exec(await readFile('./db/seed.sql', 'utf8'));
const { cookie } = await adminLogin();

async function hit(url, { method = 'GET', body, query } = {}) {
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
  // Vercel은 주소의 검색 조건을 req.query로도 넘겨준다
  const q = query ?? Object.fromEntries(new URL(url, 'http://x').searchParams);
  await router({ method, url, query: q, body, headers: { cookie } }, res);
  return res;
}

// ── 배포되는 함수 개수: api/ 아래에서 밑줄(_)로 시작하지 않는 .js 파일 = Vercel 함수 ──
const fnFiles = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    if (name.startsWith('_')) continue;
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.js')) fnFiles.push(p);
  }
};
walk('api');
check('Vercel 함수는 api/router.js 하나 (Hobby 플랜 12개 제한)', fnFiles.length === 1, fnFiles);
check('라우팅 표에 16개 API', ROUTES.length === 16, ROUTES.length);

// ── Vercel 방식: /api/router?__path=... ──
let r = await hit('/api/router?__path=users');
check('__path=users → 사용자 목록', r.statusCode === 200 && r.body.data.length === 3, r.body);

r = await hit('/api/router?__path=items', {
  method: 'POST',
  body: { name: '라우터 품목', unitCost: 10, quantity: 2 },
});
check('__path=items POST → 품목 등록 (관리자 쿠키 전달)', r.statusCode === 201, r.body);
const id = r.body.data.id;

r = await hit(`/api/router?__path=items/${id}`);
check(
  '__path=items/:id → 품목 상세 (id 전달)',
  r.statusCode === 200 && r.body.data.id === id,
  r.body,
);

r = await hit(`/api/router?__path=items/${id}/movements`);
check(
  '__path=items/:id/movements → 이력',
  r.statusCode === 200 && r.body.data.length === 1,
  r.body,
);

r = await hit('/api/router?__path=items&q=%EB%9D%BC%EC%9A%B0%ED%84%B0');
check(
  '검색 조건(q)도 함께 전달, __path는 빠짐',
  r.statusCode === 200 && r.body.data.length === 1,
  r.body,
);

r = await hit('/api/router?__path=items/bulk', {
  method: 'POST',
  body: { items: [{ name: '일괄1', unitCost: 1 }] },
});
check('__path=items/bulk → 일괄 등록 (items/:id보다 먼저)', r.statusCode === 201, r.body);

r = await hit('/api/router?__path=auth/me');
check('__path=auth/me → 관리자 세션', r.body.data.user?.role === 'admin', r.body);

r = await hit('/api/router?__path=reports&from=2026-01-01&to=2026-12-31&group=month');
check(
  '__path=reports + 조회 조건',
  r.statusCode === 200 && Array.isArray(r.body.data.rows),
  r.body,
);

r = await hit('/api/router?__path=nothing/here');
check('없는 주소 → 404 JSON', r.statusCode === 404 && r.body.error.code === 'NOT_FOUND', r.body);

r = await hit('/api/router?__path=photos/999');
check(
  '__path=photos/:id → 사진 처리 함수 (없는 사진 404)',
  r.statusCode === 404 && r.body.error.code === 'PHOTO_NOT_FOUND',
  r.body,
);

// ── 원래 주소가 그대로 올 때 (로컬 미리보기 등) ──
r = await hit(`/api/items/${id}`);
check('원래 주소 /api/items/:id 도 처리', r.statusCode === 200 && r.body.data.id === id, r.body);
r = await hit('/api/users/');
check('끝에 / 가 있어도 처리', r.statusCode === 200, r.body);

done();
