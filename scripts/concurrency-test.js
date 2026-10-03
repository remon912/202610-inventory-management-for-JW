// 동시 출고 테스트: 보유수량 10인 테스트 품목에 -1 출고 30건을 동시에 보낸다.
// 기대 결과: 성공 10건, 재고 부족 20건, 최종 보유수량 0 = 원장 합계 0.
// 사용: npm run test:concurrency   (테스트 데이터를 남기려면 -- --keep)
import { neon } from '@neondatabase/serverless';
import { recordMovement } from '../api/_lib/movement.js';

const INITIAL = 10;
const REQUESTS = 30;
const keep = process.argv.includes('--keep');
const sql = neon(process.env.DATABASE_URL);

const [user] = await sql`SELECT id FROM users ORDER BY created_at LIMIT 1`;
if (!user) {
  console.error('사용자가 없습니다. 먼저 npm run db:seed를 실행하세요.');
  process.exit(1);
}

const [item] = await sql`
  WITH new_item AS (
    INSERT INTO items (name, location, unit_cost, quantity)
    VALUES ('[테스트] 동시성 검사', '테스트', 0, ${INITIAL})
    RETURNING *
  ), initial AS (
    INSERT INTO stock_movements (item_id, user_id, delta, usage_place)
    SELECT id, ${user.id}::uuid, quantity, '초기 재고' FROM new_item
  )
  SELECT id FROM new_item`;

const results = await Promise.all(
  Array.from({ length: REQUESTS }, (_, i) =>
    recordMovement(sql, {
      itemId: item.id,
      userId: user.id,
      delta: -1,
      usagePlace: `동시 출고 #${i + 1}`,
      memo: null,
      unitPrice: null,
    }),
  ),
);

const success = results.filter((r) => r.status === 'ok').length;
const rejected = results.filter((r) => r.status === 'insufficient').length;
const [check] = await sql`
  SELECT i.quantity, COALESCE(SUM(m.delta), 0)::int AS ledger_sum
    FROM items i LEFT JOIN stock_movements m ON m.item_id = i.id
   WHERE i.id = ${item.id}
   GROUP BY i.id`;

console.log({ success, rejected, quantity: check.quantity, ledgerSum: check.ledger_sum });
const pass =
  success === INITIAL &&
  rejected === REQUESTS - INITIAL &&
  check.quantity === 0 &&
  check.ledger_sum === 0;
console.log(pass ? 'PASS: 동시 출고에서도 보유수량과 원장 합계가 일치합니다.' : 'FAIL');

if (!keep) {
  // 테스트 전용 데이터 정리 (운영 데이터는 삭제하지 않는 원장 원칙과 별개)
  await sql`DELETE FROM stock_movements WHERE item_id = ${item.id}`;
  await sql`DELETE FROM items WHERE id = ${item.id}`;
}
process.exitCode = pass ? 0 : 1;
