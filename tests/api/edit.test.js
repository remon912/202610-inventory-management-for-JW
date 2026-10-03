import { readFile } from 'node:fs/promises';
import { pg } from '../../api/_lib/db.js';
import { adminLogin, call, check, done, memberId } from './harness.js';
import login from '../../api/auth/login.js';
import me from '../../api/auth/me.js';
import users from '../../api/users/index.js';
import userById from '../../api/users/[id].js';
import places from '../../api/usage-places/index.js';
import placeById from '../../api/usage-places/[id].js';
import movements from '../../api/movements.js';

await pg.exec(await readFile('./db/schema.sql', 'utf8'));
await pg.exec(await readFile('./db/seed.sql', 'utf8'));
const { adminId, cookie } = await adminLogin('admin-pass-1');
const mid = await memberId();

// ── 사용자 수정 ──
let r = await call(userById, { method: 'PATCH', query: { id: mid }, body: { name: '김수정' } });
check('비관리자 수정 → 401', r.status === 401, r.body);
r = await call(userById, {
  method: 'PATCH',
  cookie,
  query: { id: mid },
  body: { name: '  김수정 ' },
});
check('이름 수정 → 200 (공백 제거)', r.status === 200 && r.body.data.name === '김수정', r.body);
r = await call(userById, { method: 'PATCH', cookie, query: { id: mid }, body: { name: '관리자' } });
check(
  '다른 사용자와 같은 이름 → 409',
  r.status === 409 && r.body.error.code === 'DUPLICATE_USER',
  r.body,
);
r = await call(userById, { method: 'PATCH', cookie, query: { id: mid }, body: { name: '김수정' } });
check('자기 이름 그대로 저장 → 200', r.status === 200, r.body);
r = await call(userById, { method: 'PATCH', cookie, query: { id: mid }, body: {} });
check('수정할 내용 없음 → 400', r.status === 400, r.body);
r = await call(userById, { method: 'PATCH', cookie, query: { id: mid }, body: { quantity: 1 } });
check('알 수 없는 항목 → 400', r.status === 400, r.body);
r = await call(userById, { method: 'PATCH', cookie, query: { id: mid }, body: { role: 'admin' } });
check('관리자로 승격 + 비밀번호 없음 → 400', r.status === 400, r.body);
r = await call(userById, {
  method: 'PATCH',
  cookie,
  query: { id: mid },
  body: { password: 'member-pw-1' },
});
check('일반 사용자에 비밀번호 → 400', r.status === 400, r.body);
r = await call(userById, {
  method: 'PATCH',
  cookie,
  query: { id: mid },
  body: { role: 'admin', password: 'promoted-1' },
});
check('관리자로 승격 → 200', r.status === 200 && r.body.data.role === 'admin', r.body);
r = await call(login, { method: 'POST', body: { userId: mid, password: 'promoted-1' } });
const promotedCookie = r.headers['set-cookie']?.split(';')[0];
check('승격된 관리자로 로그인', r.status === 200, r.body);
r = await call(userById, {
  method: 'PATCH',
  cookie,
  query: { id: mid },
  body: { password: 'reset-pass-2' },
});
check('다른 관리자 비밀번호 재설정 → 200', r.status === 200, r.body);
r = await call(me, { cookie: promotedCookie });
check('재설정 후 그 관리자의 기존 세션 무효', r.body.data.user === null, r.body);
r = await call(login, { method: 'POST', body: { userId: mid, password: 'reset-pass-2' } });
check('재설정한 비밀번호로 로그인', r.status === 200, r.body);
r = await call(userById, { method: 'PATCH', cookie, query: { id: mid }, body: { role: 'member' } });
check('관리자 → 일반 → 200', r.status === 200 && r.body.data.role === 'member', r.body);
const pw = (await pg.query('SELECT password_hash FROM users WHERE id=$1', [mid])).rows[0]
  .password_hash;
check('일반으로 바꾸면 비밀번호 삭제', pw === null, pw);
r = await call(login, { method: 'POST', body: { userId: mid, password: 'reset-pass-2' } });
check('일반으로 바뀐 뒤 관리자 로그인 불가', r.status === 401, r.body);

r = await call(userById, {
  method: 'PATCH',
  cookie,
  query: { id: adminId },
  body: { name: '총괄관리자' },
});
check('본인 이름 수정 → 200', r.status === 200 && r.body.data.name === '총괄관리자', r.body);
r = await call(me, { cookie });
check('본인 이름 수정 후에도 세션 유지 + 새 이름', r.body.data.user?.name === '총괄관리자', r.body);
r = await call(userById, {
  method: 'PATCH',
  cookie,
  query: { id: adminId },
  body: { role: 'member' },
});
check(
  '본인 권한 변경 → 409',
  r.status === 409 && r.body.error.code === 'CANNOT_CHANGE_SELF',
  r.body,
);
r = await call(userById, {
  method: 'PATCH',
  cookie,
  query: { id: adminId },
  body: { password: 'whatever-123' },
});
check('본인 비밀번호를 여기서 변경 → 409', r.status === 409, r.body);

// 마지막 관리자 강등 방지: 관리자 2명 → 다른 관리자 강등 OK, 그 뒤 본인만 남음
await call(users, {
  method: 'POST',
  cookie,
  body: { name: '부관리자', role: 'admin', password: 'second-admin' },
});
const [{ id: a2 }] = (await pg.query(`SELECT id FROM users WHERE name='부관리자'`)).rows;
r = await call(userById, { method: 'PATCH', cookie, query: { id: a2 }, body: { role: 'member' } });
check('관리자가 둘일 때 다른 관리자 강등 → 200', r.status === 200, r.body);
await pg.query(`UPDATE users SET role='admin' WHERE id=$1`, [a2]);
await pg.query(`UPDATE users SET role='member' WHERE id=$1`, [adminId]); // 세션 주인을 일반으로 (경계 확인용)
r = await call(userById, { method: 'PATCH', cookie, query: { id: a2 }, body: { role: 'member' } });
check('세션 주인이 관리자가 아니면 → 401', r.status === 401, r.body);
await pg.query(`UPDATE users SET role='admin' WHERE id=$1`, [adminId]);
await pg.query(`UPDATE users SET deleted_at=now() WHERE id=$1`, [a2]);
r = await call(userById, {
  method: 'PATCH',
  cookie,
  query: { id: '00000000-0000-0000-0000-000000000000' },
  body: { name: 'x' },
});
check('없는 사용자 → 404', r.status === 404, r.body);
r = await call(userById, { method: 'PATCH', cookie, query: { id: a2 }, body: { name: 'x' } });
check('삭제된 사용자 수정 → 404', r.status === 404, r.body);

// ── 사용처 수정 ──
r = await call(places, { method: 'POST', cookie, body: { name: '영업팀' } });
const p1 = r.body.data.id;
await call(places, { method: 'POST', cookie, body: { name: '총무팀' } });
await pg.exec(`INSERT INTO items (name, unit_cost, quantity) VALUES ('품목', 1, 0)`);
await call(movements, {
  method: 'POST',
  userId: mid,
  body: { itemId: 1, delta: 5, usagePlace: '입고처' },
});
r = await call(movements, {
  method: 'POST',
  userId: mid,
  body: { itemId: 1, delta: -1, usagePlace: '영업팀' },
});
check('(준비) 영업팀으로 출고', r.status === 201, r.body);

r = await call(placeById, {
  method: 'PATCH',
  userId: mid,
  query: { id: String(p1) },
  body: { name: '영업1팀' },
});
check('사용처 수정: 일반 사용자 → 401', r.status === 401, r.body);
r = await call(placeById, {
  method: 'PATCH',
  cookie,
  query: { id: String(p1) },
  body: { name: '총무팀' },
});
check(
  '사용처 수정: 이미 있는 이름 → 409',
  r.status === 409 && r.body.error.code === 'DUPLICATE_USAGE_PLACE',
  r.body,
);
r = await call(placeById, {
  method: 'PATCH',
  cookie,
  query: { id: String(p1) },
  body: { name: '' },
});
check('사용처 수정: 빈 이름 → 400', r.status === 400, r.body);
r = await call(placeById, {
  method: 'PATCH',
  cookie,
  query: { id: String(p1) },
  body: { name: '영업1팀' },
});
check('사용처 수정 → 200', r.status === 200 && r.body.data.name === '영업1팀', r.body);
r = await call(placeById, { method: 'PATCH', cookie, query: { id: '9999' }, body: { name: 'x' } });
check('없는 사용처 → 404', r.status === 404, r.body);
r = await call(movements, {
  method: 'POST',
  userId: mid,
  body: { itemId: 1, delta: -1, usagePlace: '영업1팀' },
});
check('새 이름으로 출고 → 201', r.status === 201, r.body);
r = await call(movements, {
  method: 'POST',
  userId: mid,
  body: { itemId: 1, delta: -1, usagePlace: '영업팀' },
});
check('옛 이름으로 출고 → 400', r.status === 400, r.body);
const old = (
  await pg.query(`SELECT count(*)::int c FROM stock_movements WHERE usage_place='영업팀'`)
).rows[0].c;
check('지난 출고 이력은 기록 당시 이름 유지', old === 1, old);

done();
