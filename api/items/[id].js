import { getSql } from '../_lib/db.js';
import { requireAdmin, requireUser } from '../_lib/auth.js';
import { HttpError, ok, route } from '../_lib/response.js';
import { idParam, itemUpdate } from '../_lib/validate.js';
import { toItem } from '../_lib/mappers.js';

const notFound = () => new HttpError(404, 'ITEM_NOT_FOUND', '품목을 찾을 수 없습니다.');

export default route({
  async GET(req, res) {
    const id = idParam.parse(req.query.id);
    const sql = getSql();
    const rows = await sql`
      SELECT i.*, (SELECT p.id FROM item_photos p WHERE p.item_id = i.id
                ORDER BY p.created_at DESC, p.id DESC LIMIT 1) AS photo_id
        FROM items i
       WHERE i.id = ${id}`;
    if (rows.length === 0) throw notFound();
    ok(res, toItem(rows[0]));
  },

  async PATCH(req, res) {
    await requireUser(req);
    const id = idParam.parse(req.query.id);
    const body = req.body ?? {};
    const input = itemUpdate.parse(body);
    const hasLocation = Object.hasOwn(body, 'location');
    const hasSupplier = Object.hasOwn(body, 'supplier');
    const sql = getSql();
    const rows = await sql`
      UPDATE items SET
        name         = COALESCE(${input.name ?? null}::varchar, name),
        location     = CASE WHEN ${hasLocation}::boolean THEN ${input.location ?? null}::varchar
                            ELSE location END,
        supplier     = CASE WHEN ${hasSupplier}::boolean THEN ${input.supplier ?? null}::varchar
                            ELSE supplier END,
        unit_cost    = COALESCE(${input.unitCost ?? null}::numeric, unit_cost),
        min_quantity = COALESCE(${input.minQuantity ?? null}::integer, min_quantity),
        updated_at   = now()
      WHERE id = ${id} AND deleted_at IS NULL
      RETURNING *, (SELECT p.id FROM item_photos p WHERE p.item_id = items.id
                ORDER BY p.created_at DESC, p.id DESC LIMIT 1) AS photo_id`;
    if (rows.length === 0) throw notFound();
    ok(res, toItem(rows[0]));
  },

  /**
   * 품목 삭제 (관리자 전용). 입출고 이력과 사진은 원장으로 남기고 삭제 표시만 한다.
   * 삭제된 품목은 목록·검색·입출고에서 제외되고, 입출고 현황에는 이력으로 남는다.
   */
  async DELETE(req, res) {
    await requireAdmin(req);
    const id = idParam.parse(req.query.id);
    const sql = getSql();
    const rows = await sql`
      UPDATE items SET deleted_at = now(), updated_at = now()
       WHERE id = ${id} AND deleted_at IS NULL
      RETURNING *`;
    if (rows.length === 0) throw notFound();
    ok(res, toItem(rows[0]));
  },
});
