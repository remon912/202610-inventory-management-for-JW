import { getSql } from '../_lib/db.js';
import { requireAdmin } from '../_lib/auth.js';
import { ok, route } from '../_lib/response.js';
import { itemCreate, itemListQuery } from '../_lib/validate.js';
import { toItem } from '../_lib/mappers.js';

/** LIKE 패턴의 특수문자(%, _, \)를 이스케이프 */
const likePattern = (q) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export default route({
  async GET(req, res) {
    const { q, location } = itemListQuery.parse(req.query ?? {});
    const sql = getSql();
    const rows = await sql`
      SELECT i.*, (SELECT p.id FROM item_photos p WHERE p.item_id = i.id
                ORDER BY p.created_at DESC, p.id DESC LIMIT 1) AS photo_id
        FROM items i
       WHERE i.deleted_at IS NULL
         AND (${q}::text IS NULL OR i.name ILIKE ${q ? likePattern(q) : null}::text)
         AND (${location}::text IS NULL OR i.location = ${location}::text)
       ORDER BY i.name ASC, i.id ASC
       LIMIT 1000`;
    ok(res, rows.map(toItem));
  },

  /** 품목 등록 (관리자 전용) */
  async POST(req, res) {
    const user = await requireAdmin(req);
    const input = itemCreate.parse(req.body ?? {});
    const image = input.photo?.image ?? null;
    const thumb = input.photo?.thumb ?? null;
    const sql = getSql();
    // 원장 원칙: 초기 보유수량도 이력 1건으로 남겨 SUM(delta)와 일치시킨다.
    const rows = await sql`
      WITH new_item AS (
        INSERT INTO items (name, location, supplier, unit_cost, quantity, min_quantity)
        VALUES (${input.name}, ${input.location}, ${input.supplier}, ${input.unitCost}::numeric,
                ${input.quantity}::integer, ${input.minQuantity}::integer)
        RETURNING *
      ),
      initial AS (
        INSERT INTO stock_movements (item_id, user_id, delta, usage_place, memo, unit_price)
        SELECT id, ${user.id}::uuid, quantity, '초기 재고', '품목 등록 시 초기 보유수량', unit_cost
          FROM new_item
         WHERE quantity > 0
        RETURNING id
      ),
      photo AS (
        INSERT INTO item_photos (item_id, user_id, image, thumb)
        SELECT id, ${user.id}::uuid, decode(${image}::text, 'base64'), decode(${thumb}::text, 'base64')
          FROM new_item
         WHERE ${image}::text IS NOT NULL
        RETURNING id
      )
      SELECT new_item.*, (SELECT id FROM photo) AS photo_id FROM new_item`;
    ok(res, toItem(rows[0]), 201);
  },
});
