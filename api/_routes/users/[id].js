import { getSql } from '../../_lib/db.js';
import { requireAdmin } from '../../_lib/auth.js';
import { hashPassword } from '../../_lib/password.js';
import { HttpError, ok, route } from '../../_lib/response.js';
import { userUpdate, uuidParam } from '../../_lib/validate.js';

const lastAdmin = () =>
  new HttpError(409, 'LAST_ADMIN', '마지막 관리자는 일반으로 바꾸거나 삭제할 수 없습니다.');

export default route({
  /**
   * 사용자 수정 (관리자 전용): 이름, 권한, 관리자 비밀번호 재설정
   * - 일반 → 관리자: 비밀번호 필수
   * - 관리자 → 일반: 비밀번호를 지우고 기존 로그인 세션을 무효화
   * - 본인: 이름만 수정 가능 (권한·비밀번호는 '내 비밀번호 변경'에서)
   */
  async PATCH(req, res) {
    const admin = await requireAdmin(req);
    const id = uuidParam.parse(req.query.id);
    const input = userUpdate.parse(req.body ?? {});
    const sql = getSql();

    const [target] = await sql`
      SELECT id, name, role FROM users WHERE id = ${id} AND deleted_at IS NULL`;
    if (!target) throw new HttpError(404, 'USER_NOT_FOUND', '사용자를 찾을 수 없습니다.');

    const nextRole = input.role ?? target.role;
    if (id === admin.id && (nextRole !== target.role || input.password)) {
      throw new HttpError(
        409,
        'CANNOT_CHANGE_SELF',
        '본인의 권한과 비밀번호는 여기서 바꿀 수 없습니다. 비밀번호는 아래 ‘내 비밀번호 변경’을 이용하세요.',
      );
    }
    if (target.role === 'member' && nextRole === 'admin' && !input.password) {
      throw new HttpError(400, 'VALIDATION_ERROR', '관리자로 바꾸려면 비밀번호를 정해 주세요.');
    }
    if (nextRole === 'member' && input.password) {
      throw new HttpError(400, 'VALIDATION_ERROR', '일반 사용자는 비밀번호를 쓰지 않습니다.');
    }
    if (input.name) {
      const dup = await sql`
        SELECT 1 FROM users
         WHERE lower(name) = lower(${input.name}::varchar) AND id <> ${id} AND deleted_at IS NULL`;
      if (dup.length > 0) {
        throw new HttpError(409, 'DUPLICATE_USER', `이미 '${input.name}' 사용자가 있습니다.`);
      }
    }

    const hash = input.password ? await hashPassword(input.password) : null;
    const demote = target.role === 'admin' && nextRole === 'member';
    const rows = await sql`
      UPDATE users SET
        name                = COALESCE(${input.name ?? null}::varchar, name),
        role                = ${nextRole}::varchar,
        password_hash       = CASE WHEN ${hash}::text IS NOT NULL THEN ${hash}::text
                                   WHEN ${demote}::boolean THEN NULL
                                   ELSE password_hash END,
        password_changed_at = CASE WHEN ${hash}::text IS NOT NULL OR ${demote}::boolean THEN now()
                                   ELSE password_changed_at END,
        failed_logins       = CASE WHEN ${hash}::text IS NOT NULL THEN 0 ELSE failed_logins END,
        locked_until        = CASE WHEN ${hash}::text IS NOT NULL THEN NULL ELSE locked_until END
       WHERE id = ${id} AND deleted_at IS NULL
         AND NOT (${demote}::boolean
                  AND (SELECT count(*) FROM users WHERE role = 'admin' AND deleted_at IS NULL) <= 1)
      RETURNING id, name, role`;
    if (rows.length === 0) throw lastAdmin();
    ok(res, rows[0]);
  },

  /**
   * 사용자 삭제 (관리자 전용). 입출고 이력의 기록자를 보존하기 위해 삭제 표시만 한다.
   * 로그인한 본인과 마지막 관리자는 삭제할 수 없다.
   */
  async DELETE(req, res) {
    const admin = await requireAdmin(req);
    const id = uuidParam.parse(req.query.id);
    if (id === admin.id) {
      throw new HttpError(409, 'CANNOT_DELETE_SELF', '로그인한 본인은 삭제할 수 없습니다.');
    }
    const sql = getSql();
    const rows = await sql`
      UPDATE users SET deleted_at = now()
       WHERE id = ${id} AND deleted_at IS NULL
         AND (role <> 'admin'
              OR (SELECT count(*) FROM users WHERE role = 'admin' AND deleted_at IS NULL) > 1)
      RETURNING id, name, role`;
    if (rows.length === 0) {
      const exists = await sql`SELECT 1 FROM users WHERE id = ${id} AND deleted_at IS NULL`;
      if (exists.length === 0) {
        throw new HttpError(404, 'USER_NOT_FOUND', '사용자를 찾을 수 없습니다.');
      }
      throw lastAdmin();
    }
    ok(res, rows[0]);
  },
});
