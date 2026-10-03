import { getSql } from './db.js';
import { HttpError } from './response.js';
import { passwordVersion, readToken } from './session.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const adminLoginRequired = () =>
  new HttpError(
    401,
    'ADMIN_LOGIN_REQUIRED',
    '관리자 로그인이 필요합니다. 비밀번호를 입력해 주세요.',
  );

/** 유효한 관리자 세션이면 { id, name, role }, 아니면 null */
export async function getAdminSession(req) {
  const token = readToken(req);
  if (!token || typeof token.uid !== 'string' || !UUID_RE.test(token.uid)) return null;
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, role, password_changed_at FROM users
     WHERE id = ${token.uid} AND role = 'admin' AND deleted_at IS NULL`;
  const user = rows[0];
  if (!user || passwordVersion(user.password_changed_at) !== token.v) return null;
  return { id: user.id, name: user.name, role: user.role };
}

/**
 * 기록자 확인: X-User-Id가 삭제되지 않은 사용자인지 확인한다.
 * 관리자 이름으로 기록하려면 그 관리자로 로그인한 세션이 있어야 한다 (사칭 방지).
 * 일반 사용자는 간이 사용자 선택 방식이라 보안 인증이 아니라 기록자 식별용이다.
 */
export async function requireUser(req) {
  const id = req.headers['x-user-id'];
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    throw new HttpError(401, 'UNAUTHORIZED', '사용자를 먼저 선택해 주세요.');
  }
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, role FROM users WHERE id = ${id} AND deleted_at IS NULL`;
  const user = rows[0];
  if (!user) {
    throw new HttpError(
      401,
      'UNAUTHORIZED',
      '등록되지 않은 사용자입니다. 사용자를 다시 선택해 주세요.',
    );
  }
  if (user.role === 'admin') {
    const session = await getAdminSession(req);
    if (!session || session.id !== user.id) throw adminLoginRequired();
  }
  return user;
}

/** 관리자 전용 기능: 관리자 세션 필수 */
export async function requireAdmin(req) {
  const session = await getAdminSession(req);
  if (!session) throw adminLoginRequired();
  return session;
}
