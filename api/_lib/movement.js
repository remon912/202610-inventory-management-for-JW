/**
 * 수량 증감과 이력 기록을 하나의 SQL 문(CTE)으로 처리한다.
 * - 조건부 UPDATE가 행 잠금을 잡으므로 동시 요청은 순서대로 평가된다.
 * - 마이너스 재고가 되면 UPDATE가 0행 → INSERT도 0행 (이력 미기록).
 * - 입고 사진(photo)이 있으면 같은 문장에서 함께 저장한다.
 */
export async function recordMovement(
  sql,
  { itemId, userId, delta, usagePlace, memo, unitPrice, photo = null },
) {
  const image = photo?.image ?? null;
  const thumb = photo?.thumb ?? null;
  const rows = await sql`
    WITH updated AS (
      UPDATE items
         SET quantity   = quantity + ${delta}::integer,
             updated_at = now()
       WHERE id = ${itemId}
         AND deleted_at IS NULL
         AND quantity + ${delta}::integer >= 0
      RETURNING id, quantity
    ),
    inserted AS (
      INSERT INTO stock_movements (item_id, user_id, delta, usage_place, memo, unit_price)
      SELECT id, ${userId}::uuid, ${delta}::integer, ${usagePlace}, ${memo}, ${unitPrice}::numeric
        FROM updated
      RETURNING *
    ),
    photo AS (
      INSERT INTO item_photos (item_id, movement_id, user_id, image, thumb)
      SELECT item_id, id, user_id, decode(${image}::text, 'base64'), decode(${thumb}::text, 'base64')
        FROM inserted
       WHERE ${image}::text IS NOT NULL
      RETURNING id
    )
    SELECT inserted.*, updated.quantity AS item_quantity, (SELECT id FROM photo) AS photo_id
      FROM inserted
      JOIN updated ON updated.id = inserted.item_id`;

  if (rows.length === 1) return { status: 'ok', row: rows[0] };

  const items = await sql`SELECT quantity FROM items WHERE id = ${itemId} AND deleted_at IS NULL`;
  if (items.length === 0) return { status: 'not_found' };
  return { status: 'insufficient', currentQuantity: items[0].quantity };
}
