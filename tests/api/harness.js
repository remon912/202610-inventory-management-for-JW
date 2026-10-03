// 공통 테스트 도구: 핸들러 호출, 관리자 로그인 쿠키
import { pg } from '../../api/_lib/db.js';
import { hashPassword } from '../../api/_lib/password.js';
import login from '../../api/auth/login.js';

process.env.SESSION_SECRET ??= 'test-secret-test-secret-test-secret-1234';

export async function call(handler, { method = 'GET', query = {}, body, userId, cookie } = {}) {
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
  const headers = {};
  if (userId) headers['x-user-id'] = userId;
  if (cookie) headers.cookie = cookie;
  await handler({ method, query, body, url: '/t', headers }, res);
  return { status: res.statusCode, body: res.body, headers: res.headers, raw: res.raw };
}

export const cookieOf = (r) => (r.headers['set-cookie'] ?? '').split(';')[0];

/** 시드의 '관리자'에게 비밀번호를 설정하고 로그인 쿠키를 돌려준다 */
export async function adminLogin(password = 'admin-pass-1') {
  const { rows } = await pg.query(
    `SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1`,
  );
  await pg.query('UPDATE users SET password_hash = $1, password_changed_at = now() WHERE id = $2', [
    await hashPassword(password),
    rows[0].id,
  ]);
  const r = await call(login, { method: 'POST', body: { userId: rows[0].id, password } });
  return { adminId: rows[0].id, cookie: cookieOf(r) };
}

export async function memberId() {
  const { rows } = await pg.query(
    `SELECT id FROM users WHERE role = 'member' ORDER BY name LIMIT 1`,
  );
  return rows[0].id;
}

let failures = 0;
export function check(label, cond, extra) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
  if (!cond) {
    failures++;
    console.log('      ', JSON.stringify(extra)?.slice(0, 400));
  }
}
export function done() {
  console.log(failures ? `\n${failures}건 실패` : '\n전체 통과');
  process.exitCode = failures ? 1 : 0;
}
