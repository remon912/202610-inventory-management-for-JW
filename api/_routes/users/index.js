import { getSql } from '../../_lib/db.js';
import { requireAdmin } from '../../_lib/auth.js';
import { hashPassword } from '../../_lib/password.js';
import { HttpError, ok, route } from '../../_lib/response.js';
import { userCreate } from '../../_lib/validate.js';

export default route({
  /** 삭제되지 않은 사용자 목록 (비밀번호 관련 정보는 내보내지 않음) */
  async GET(_req, res) {
    const sql = getSql();
    const rows = await sql`
      SELECT id, name, role FROM users WHERE deleted_at IS NULL ORDER BY name ASC`;
    ok(res, rows);
  },

  /** 사용자 추가 (관리자 전용). 관리자를 추가할 때는 비밀번호 필수 */
  async POST(req, res) {
    await requireAdmin(req);
    const { name, role, password } = userCreate.parse(req.body ?? {});
    const hash = role === 'admin' ? await hashPassword(password) : null;
    const sql = getSql();
    const rows = await sql`
      INSERT INTO users (name, role, password_hash, password_changed_at)
      SELECT ${name}::varchar, ${role}::varchar, ${hash}::text,
             CASE WHEN ${hash}::text IS NULL THEN NULL ELSE now() END
       WHERE NOT EXISTS (
         SELECT 1 FROM users WHERE lower(name) = lower(${name}::varchar) AND deleted_at IS NULL)
      RETURNING id, name, role`;
    if (rows.length === 0) {
      throw new HttpError(409, 'DUPLICATE_USER', `이미 '${name}' 사용자가 있습니다.`);
    }
    ok(res, rows[0], 201);
  },
});
