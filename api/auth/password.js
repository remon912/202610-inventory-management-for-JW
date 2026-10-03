import { getSql } from '../_lib/db.js';
import { requireAdmin } from '../_lib/auth.js';
import { hashPassword, verifyPassword } from '../_lib/password.js';
import { HttpError, ok, route } from '../_lib/response.js';
import { setSessionCookie } from '../_lib/session.js';
import { passwordChange } from '../_lib/validate.js';

/** 로그인한 관리자의 비밀번호 변경. 다른 기기의 기존 세션은 무효가 된다. */
export default route({
  async POST(req, res) {
    const admin = await requireAdmin(req);
    const { current, next } = passwordChange.parse(req.body ?? {});
    const sql = getSql();
    const [row] = await sql`SELECT password_hash FROM users WHERE id = ${admin.id}`;
    if (!(await verifyPassword(current, row?.password_hash))) {
      throw new HttpError(400, 'INVALID_CREDENTIALS', '현재 비밀번호가 올바르지 않습니다.');
    }
    const hash = await hashPassword(next);
    const [user] = await sql`
      UPDATE users SET password_hash = ${hash}, password_changed_at = now(),
                       failed_logins = 0, locked_until = NULL
       WHERE id = ${admin.id}
      RETURNING id, name, role, password_changed_at`;
    setSessionCookie(req, res, user); // 현재 기기는 새 세션으로 유지
    ok(res, { user: { id: user.id, name: user.name, role: user.role } });
  },
});
