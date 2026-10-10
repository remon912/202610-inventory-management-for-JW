import { getSql } from '../../_lib/db.js';
import { requireAdmin } from '../../_lib/auth.js';
import { HttpError, ok, route } from '../../_lib/response.js';
import { itemBulkCreate } from '../../_lib/validate.js';
import { toItem } from '../../_lib/mappers.js';

const key = (name) => name.trim().toLowerCase();

/**
 * 품목 일괄 등록 (관리자 전용). POST /api/items/bulk { items: [...] }
 * - 전부 등록되거나 하나도 등록되지 않는다 (SQL 한 문장).
 * - 같은 파일을 두 번 올리는 실수를 막기 위해, 이미 있는 품목명·목록 안의 중복 이름은 거부한다.
 * - 초기 보유수량은 품목마다 '초기 재고' 이력으로 남겨 원장 합계와 일치시킨다.
 */
export default route({
  async POST(req, res) {
    const user = await requireAdmin(req);
    const { items } = itemBulkCreate.parse(req.body ?? {});

    // 목록 안의 중복 이름 (몇 번째 줄인지 0부터)
    const seen = new Map();
    const dupInList = [];
    items.forEach((it, i) => {
      const k = key(it.name);
      if (seen.has(k)) dupInList.push({ row: i, name: it.name, firstRow: seen.get(k) });
      else seen.set(k, i);
    });
    if (dupInList.length > 0) {
      throw new HttpError(409, 'DUPLICATE_IN_LIST', '목록 안에 같은 품목명이 여러 번 있습니다.', {
        rows: dupInList,
      });
    }

    const sql = getSql();
    const names = JSON.stringify(items.map((it) => key(it.name)));
    const existing = await sql`
      SELECT name FROM items
       WHERE deleted_at IS NULL
         AND lower(btrim(name)) IN (SELECT jsonb_array_elements_text(${names}::jsonb))`;
    if (existing.length > 0) {
      const taken = new Set(existing.map((r) => key(r.name)));
      throw new HttpError(409, 'DUPLICATE_ITEMS', '이미 등록된 품목명이 있습니다.', {
        rows: items
          .map((it, i) => ({ row: i, name: it.name }))
          .filter((r) => taken.has(key(r.name))),
      });
    }

    const payload = JSON.stringify(
      items.map((it, i) => ({
        idx: i,
        name: it.name,
        location: it.location,
        supplier: it.supplier,
        unit_cost: it.unitCost,
        quantity: it.quantity,
        min_quantity: it.minQuantity,
      })),
    );
    const rows = await sql`
      WITH input AS (
        SELECT * FROM jsonb_to_recordset(${payload}::jsonb)
          AS x(idx int, name text, location text, supplier text,
               unit_cost numeric, quantity int, min_quantity int)
      ),
      new_items AS (
        INSERT INTO items (name, location, supplier, unit_cost, quantity, min_quantity)
        SELECT name, location, supplier, unit_cost, quantity, min_quantity
          FROM input
         ORDER BY idx
        RETURNING *
      ),
      initial AS (
        INSERT INTO stock_movements (item_id, user_id, delta, usage_place, memo, unit_price)
        SELECT id, ${user.id}::uuid, quantity, '초기 재고', '일괄 등록 시 초기 보유수량', unit_cost
          FROM new_items
         WHERE quantity > 0
        RETURNING id
      )
      SELECT new_items.*, NULL::bigint AS photo_id FROM new_items ORDER BY id`;

    ok(res, { count: rows.length, items: rows.map(toItem) }, 201);
  },
});
