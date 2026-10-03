import { readFile } from 'node:fs/promises';
import { pg } from '../../api/_lib/db.js';
import { hashPassword } from '../../api/_lib/password.js';
import { adminLogin, call, check, cookieOf, done, memberId } from './harness.js';
import login from '../../api/auth/login.js';
import logout from '../../api/auth/logout.js';
import me from '../../api/auth/me.js';
import password from '../../api/auth/password.js';
import users from '../../api/users/index.js';
import userById from '../../api/users/[id].js';
import places from '../../api/usage-places/index.js';
import placeById from '../../api/usage-places/[id].js';
import items from '../../api/items/index.js';
import itemById from '../../api/items/[id].js';
import movements from '../../api/movements.js';
import reports from '../../api/reports.js';

await pg.exec(await readFile('./db/schema.sql', 'utf8'));
await pg.exec(await readFile('./db/seed.sql', 'utf8'));
const mid = await memberId();
const [{ id: adminId }] = (await pg.query(`SELECT id FROM users WHERE role='admin'`)).rows;

// ── 로그인 ──
let r = await call(login, { method: 'POST', body: { userId: adminId, password: 'x' } });
check('비밀번호 미설정 관리자 → 401', r.status === 401, r.body);
await pg.query('UPDATE users SET password_hash = $1, password_changed_at = now() WHERE id = $2', [
  await hashPassword('correct-horse'),
  adminId,
]);
r = await call(login, { method: 'POST', body: { userId: mid, password: 'correct-horse' } });
check('일반 사용자로 로그인 시도 → 401', r.status === 401, r.body);
r = await call(login, { method: 'POST', body: { userId: adminId, password: 'wrong' } });
check(
  '틀린 비밀번호 → 401, 남은 횟수 안내',
  r.status === 401 && r.body.error.message.includes('4회'),
  r.body,
);
r = await call(login, { method: 'POST', body: { userId: adminId, password: 'correct-horse' } });
const cookie = cookieOf(r);
check(
  '올바른 비밀번호 → 200 + HttpOnly·SameSite 쿠키',
  r.status === 200 &&
    /HttpOnly/.test(r.headers['set-cookie']) &&
    /SameSite=Strict/.test(r.headers['set-cookie']) &&
    cookie.startsWith('inv_admin='),
  r.headers,
);
const fails = (await pg.query('SELECT failed_logins FROM users WHERE id=$1', [adminId])).rows[0]
  .failed_logins;
check('성공하면 실패 횟수 초기화', fails === 0, fails);
r = await call(me, { cookie });
check('GET /api/auth/me → 관리자', r.body.data.user?.id === adminId, r.body);
r = await call(me, {});
check('쿠키 없으면 me → null', r.body.data.user === null, r.body);
r = await call(me, { cookie: cookie.slice(0, -3) + 'abc' });
check('위조된 쿠키 → null', r.body.data.user === null, r.body);

// ── 잠금 ──
await pg.query(
  `INSERT INTO users (name, role, password_hash, password_changed_at) VALUES ('부관리자', 'admin', $1, now())`,
  [await hashPassword('second-admin')],
);
const [{ id: admin2 }] = (await pg.query(`SELECT id FROM users WHERE name='부관리자'`)).rows;
for (let i = 0; i < 5; i++) {
  await call(login, { method: 'POST', body: { userId: admin2, password: 'bad' } });
}
r = await call(login, { method: 'POST', body: { userId: admin2, password: 'second-admin' } });
check(
  '5회 실패 후에는 맞는 비밀번호도 429 잠금',
  r.status === 429 && r.body.error.code === 'LOGIN_LOCKED',
  r.body,
);

// ── 관리자 사칭 방지 ──
await pg.exec(`INSERT INTO items (name, unit_cost, quantity) VALUES ('테스트', 100, 0)`);
r = await call(movements, {
  method: 'POST',
  userId: adminId,
  body: { itemId: 1, delta: 5, usagePlace: 'x' },
});
check(
  '관리자 ID로 기록 + 세션 없음 → 401 ADMIN_LOGIN_REQUIRED',
  r.status === 401 && r.body.error.code === 'ADMIN_LOGIN_REQUIRED',
  r.body,
);
r = await call(movements, {
  method: 'POST',
  userId: adminId,
  cookie,
  body: { itemId: 1, delta: 5, usagePlace: 'x' },
});
check('관리자 ID로 기록 + 본인 세션 → 201', r.status === 201, r.body);
r = await call(movements, {
  method: 'POST',
  userId: mid,
  body: { itemId: 1, delta: 1, usagePlace: 'x' },
});
check('일반 사용자는 로그인 없이 기록 → 201', r.status === 201, r.body);

// ── 사용자 관리 ──
r = await call(users, { method: 'POST', body: { name: '신입' } });
check('사용자 추가: 비관리자 → 401', r.status === 401, r.body);
r = await call(users, { method: 'POST', userId: mid, body: { name: '신입' } });
check('사용자 추가: 일반 사용자 → 401', r.status === 401, r.body);
r = await call(users, { method: 'POST', cookie, body: { name: '신입' } });
check(
  '사용자 추가: 관리자 → 201 (일반)',
  r.status === 201 && r.body.data.role === 'member',
  r.body,
);
const newbie = r.body.data.id;
r = await call(users, { method: 'POST', cookie, body: { name: '팀장', role: 'admin' } });
check('관리자 추가 시 비밀번호 없음 → 400', r.status === 400, r.body);
r = await call(users, {
  method: 'POST',
  cookie,
  body: { name: '팀장', role: 'admin', password: 'short' },
});
check('관리자 비밀번호 8자 미만 → 400', r.status === 400, r.body);
r = await call(users, {
  method: 'POST',
  cookie,
  body: { name: '팀장', role: 'admin', password: 'team-lead-pw' },
});
check('관리자 추가 → 201', r.status === 201 && r.body.data.role === 'admin', r.body);
r = await call(login, {
  method: 'POST',
  body: { userId: r.body.data.id, password: 'team-lead-pw' },
});
check('추가한 관리자로 로그인 가능', r.status === 200, r.body);
r = await call(users, {});
check(
  '사용자 목록에 비밀번호 정보 없음',
  r.body.data.every((u) => Object.keys(u).sort().join() === 'id,name,role'),
  r.body.data[0],
);

r = await call(userById, { method: 'DELETE', query: { id: newbie } });
check('사용자 삭제: 비관리자 → 401', r.status === 401, r.body);
r = await call(userById, { method: 'DELETE', cookie, query: { id: adminId } });
check('본인 삭제 → 409', r.status === 409 && r.body.error.code === 'CANNOT_DELETE_SELF', r.body);
r = await call(userById, { method: 'DELETE', cookie, query: { id: newbie } });
check('사용자 삭제 → 200', r.status === 200, r.body);
r = await call(users, {});
check('삭제된 사용자는 목록에서 제외', !r.body.data.some((u) => u.id === newbie), r.body.data);
r = await call(users, { method: 'POST', cookie, body: { name: '신입' } });
check('삭제된 사용자와 같은 이름 다시 추가 가능', r.status === 201, r.body);
r = await call(movements, {
  method: 'POST',
  userId: newbie,
  body: { itemId: 1, delta: 1, usagePlace: 'x' },
});
check('삭제된 사용자로 기록 → 401', r.status === 401, r.body);
await pg.query(`UPDATE users SET deleted_at = now() WHERE role = 'admin' AND id <> $1`, [adminId]);
r = await call(userById, { method: 'DELETE', cookie, query: { id: adminId } });
check('(본인 확인이 먼저) 마지막 관리자 본인 → 409', r.status === 409, r.body);

// ── 사용처 관리 ──
r = await call(places, { method: 'POST', userId: mid, body: { name: '영업팀' } });
check('사용처 등록: 일반 사용자 → 401', r.status === 401, r.body);
r = await call(places, { method: 'POST', cookie, body: { name: '영업팀' } });
check('사용처 등록: 관리자 → 201', r.status === 201, r.body);
const placeId = r.body.data.id;
r = await call(movements, {
  method: 'POST',
  userId: mid,
  body: { itemId: 1, delta: -1, usagePlace: '영업팀' },
});
check('등록된 사용처로 출고 → 201', r.status === 201, r.body);
r = await call(placeById, { method: 'DELETE', userId: mid, query: { id: String(placeId) } });
check('사용처 삭제: 일반 사용자 → 401', r.status === 401, r.body);
r = await call(placeById, { method: 'DELETE', cookie, query: { id: String(placeId) } });
check('사용처 삭제: 관리자 → 200', r.status === 200, r.body);
r = await call(movements, {
  method: 'POST',
  userId: mid,
  body: { itemId: 1, delta: -1, usagePlace: '영업팀' },
});
check(
  '삭제된 사용처로 출고 → 400',
  r.status === 400 && r.body.error.code === 'USAGE_PLACE_NOT_FOUND',
  r.body,
);
const hist = (
  await pg.query(`SELECT count(*)::int c FROM stock_movements WHERE usage_place='영업팀'`)
).rows[0].c;
check('사용처를 지워도 기존 출고 이력은 유지', hist === 1, hist);

// ── 품목 삭제 ──
r = await call(itemById, { method: 'DELETE', userId: mid, query: { id: '1' } });
check('품목 삭제: 일반 사용자 → 401', r.status === 401, r.body);
r = await call(itemById, { method: 'DELETE', cookie, query: { id: '1' } });
check('품목 삭제: 관리자 → 200, deletedAt', r.status === 200 && r.body.data.deletedAt, r.body);
r = await call(items, {});
check('삭제된 품목은 목록에서 제외', r.body.data.length === 0, r.body.data);
r = await call(itemById, { query: { id: '1' } });
check(
  '삭제된 품목 상세는 deletedAt과 함께 조회',
  r.status === 200 && r.body.data.deletedAt,
  r.body,
);
r = await call(movements, {
  method: 'POST',
  userId: mid,
  body: { itemId: 1, delta: 1, usagePlace: 'x' },
});
check('삭제된 품목에 입고 → 404', r.status === 404, r.body);
r = await call(itemById, {
  method: 'PATCH',
  cookie,
  query: { id: '1' },
  body: { unitCost: 1 },
});
check('삭제된 품목 수정(관리자) → 404', r.status === 404, r.body);
r = await call(itemById, { method: 'DELETE', cookie, query: { id: '1' } });
check('이미 삭제된 품목 다시 삭제 → 404', r.status === 404, r.body);
const today = new Date().toISOString().slice(0, 10);
r = await call(reports, {
  query: { from: '2026-01-01', to: today < '2026-01-01' ? '2026-01-01' : today, group: 'month' },
});
check(
  '입출고 현황에는 삭제 품목 이력이 deleted=true로 남음',
  r.body.data.rows.some((x) => x.itemId === 1 && x.deleted === true),
  r.body,
);

// ── 비밀번호 변경 ──
r = await call(password, {
  method: 'POST',
  cookie,
  body: { current: 'wrong', next: 'new-password-1' },
});
check('현재 비밀번호 틀림 → 400', r.status === 400, r.body);
r = await call(password, {
  method: 'POST',
  cookie,
  body: { current: 'correct-horse', next: 'short' },
});
check('새 비밀번호 8자 미만 → 400', r.status === 400, r.body);
await new Promise((ok) => setTimeout(ok, 5));
r = await call(password, {
  method: 'POST',
  cookie,
  body: { current: 'correct-horse', next: 'new-password-1' },
});
const newCookie = cookieOf(r);
check(
  '비밀번호 변경 → 200 + 새 쿠키',
  r.status === 200 && newCookie && newCookie !== cookie,
  r.body,
);
r = await call(me, { cookie });
check('예전 쿠키는 무효', r.body.data.user === null, r.body);
r = await call(me, { cookie: newCookie });
check('새 쿠키는 유효', r.body.data.user?.id === adminId, r.body);
r = await call(login, { method: 'POST', body: { userId: adminId, password: 'new-password-1' } });
check('새 비밀번호로 로그인', r.status === 200, r.body);

r = await call(logout, { method: 'POST', cookie: newCookie });
check('로그아웃 → 쿠키 삭제(Max-Age=0)', /Max-Age=0/.test(r.headers['set-cookie']), r.headers);

void adminLogin;
done();
