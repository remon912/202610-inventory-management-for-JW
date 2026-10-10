import { getSql } from '../../../_lib/db.js';
import { HttpError, ok, route } from '../../../_lib/response.js';
import { idParam, movementListQuery } from '../../../_lib/validate.js';
import { toMovement } from '../../../_lib/mappers.js';

export default route({
  async GET(req, res) {
    const id = idParam.parse(req.query.id);
    const { limit } = movementListQuery.parse({ limit: req.query.limit });
    const sql = getSql();
    const exists = await sql`SELECT 1 FROM items WHERE id = ${id}`;
    if (exists.length === 0) throw new HttpError(404, 'ITEM_NOT_FOUND', '품목을 찾을 수 없습니다.');
    const rows = await sql`
      SELECT m.*, u.name AS user_name,
             (SELECT p.id FROM item_photos p WHERE p.movement_id = m.id
               ORDER BY p.id LIMIT 1) AS photo_id
        FROM stock_movements m
        JOIN users u ON u.id = m.user_id
       WHERE m.item_id = ${id}
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT ${limit}`;
    ok(res, rows.map(toMovement));
  },
});
