import { getSql } from '../../_lib/db.js';
import { verifyPassword } from '../../_lib/password.js';
import { HttpError, ok, route } from '../../_lib/response.js';
import { setSessionCookie } from '../../_lib/session.js';
import { loginInput } from '../../_lib/validate.js';

const MAX_FAILURES = 5;
const LOCK_MINUTES = 5;

/** 관리자 로그인. 5회 연속 실패하면 5분간 잠근다. */
export default route({
  async POST(req, res) {
    const { userId, password } = loginInput.parse(req.body ?? {});
    const sql = getSql();
    const rows = await sql`
      SELECT id, name, role, password_hash, password_changed_at, locked_until
        FROM users
       WHERE id = ${userId} AND role = 'admin' AND deleted_at IS NULL`;
    const user = rows[0];
    if (!user || !user.password_hash) {
      throw new HttpError(
        401,
        'INVALID_CREDENTIALS',
        '관리자 비밀번호가 설정되지 않았거나 관리자가 아닙니다.',
      );
    }
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new HttpError(
        429,
        'LOGIN_LOCKED',
        `비밀번호를 여러 번 틀려 잠겼습니다. ${LOCK_MINUTES}분 후 다시 시도해 주세요.`,
      );
    }

    if (!(await verifyPassword(password, user.password_hash))) {
      const [after] = await sql`
        UPDATE users
           SET failed_logins = failed_logins + 1,
               locked_until = CASE WHEN failed_logins + 1 >= ${MAX_FAILURES}
                                   THEN now() + make_interval(mins => ${LOCK_MINUTES})
                                   ELSE locked_until END
         WHERE id = ${user.id}
        RETURNING failed_logins`;
      const left = Math.max(0, MAX_FAILURES - after.failed_logins);
      throw new HttpError(
        401,
        'INVALID_CREDENTIALS',
        left > 0
          ? `비밀번호가 올바르지 않습니다. (${left}회 더 틀리면 ${LOCK_MINUTES}분간 잠깁니다)`
          : `비밀번호를 여러 번 틀려 잠겼습니다. ${LOCK_MINUTES}분 후 다시 시도해 주세요.`,
      );
    }

    await sql`UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ${user.id}`;
    setSessionCookie(req, res, user);
    ok(res, { user: { id: user.id, name: user.name, role: user.role } });
  },
});
