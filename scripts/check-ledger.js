// 모든 품목의 items.quantity가 SUM(stock_movements.delta)와 일치하는지 검사한다.
// 사용: npm run db:check
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

const rows = await sql`
  SELECT i.id, i.name, i.quantity, COALESCE(SUM(m.delta), 0)::int AS ledger_sum
    FROM items i
    LEFT JOIN stock_movements m ON m.item_id = i.id
   GROUP BY i.id
  HAVING i.quantity <> COALESCE(SUM(m.delta), 0)
   ORDER BY i.id`;

if (rows.length === 0) {
  console.log('정합성 OK: 모든 품목의 보유수량이 원장 합계와 일치합니다.');
} else {
  console.error(`불일치 ${rows.length}건:`);
  console.table(rows);
  process.exitCode = 1;
}
