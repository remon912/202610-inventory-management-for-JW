import { getSql } from '../../_lib/db.js';
import { requireAdmin } from '../../_lib/auth.js';
import { HttpError, ok, route } from '../../_lib/response.js';
import { idParam, usagePlaceUpdate } from '../../_lib/validate.js';

const notFound = () => new HttpError(404, 'USAGE_PLACE_NOT_FOUND', '사용처를 찾을 수 없습니다.');
const toPlace = (r) => ({ id: Number(r.id), name: r.name });

export default route({
  /**
   * 사용처 이름 수정 (관리자 전용). 지난 출고 이력은 원장이므로 기록 당시 이름을 그대로 둔다.
   */
  async PATCH(req, res) {
    await requireAdmin(req);
    const id = idParam.parse(req.query.id);
    const { name } = usagePlaceUpdate.parse(req.body ?? {});
    const sql = getSql();
    const dup = await sql`SELECT 1 FROM usage_places WHERE name = ${name} AND id <> ${id}`;
    if (dup.length > 0) {
      throw new HttpError(409, 'DUPLICATE_USAGE_PLACE', `이미 '${name}' 사용처가 있습니다.`);
    }
    const rows = await sql`
      UPDATE usage_places SET name = ${name} WHERE id = ${id} RETURNING id, name`;
    if (rows.length === 0) throw notFound();
    ok(res, toPlace(rows[0]));
  },

  /**
   * 사용처 삭제 (관리자 전용). 출고 이력은 사용처 이름을 글자로 저장하므로 이력은 그대로 남고,
   * 이후 출고에서만 이 사용처를 선택할 수 없게 된다.
   */
  async DELETE(req, res) {
    await requireAdmin(req);
    const id = idParam.parse(req.query.id);
    const sql = getSql();
    const rows = await sql`DELETE FROM usage_places WHERE id = ${id} RETURNING id, name`;
    if (rows.length === 0) throw notFound();
    ok(res, toPlace(rows[0]));
  },
});
