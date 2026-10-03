import { getSql } from './_lib/db.js';
import { ok, route } from './_lib/response.js';
import { reportQuery } from './_lib/validate.js';

const num = (v) => (v === null || v === undefined ? 0 : Number(v));

/**
 * 입출고 현황 집계
 * GET /api/reports?from=YYYY-MM-DD&to=YYYY-MM-DD&group=day|month&by=item|place&itemId=&place=&detail=1
 * - by=item : 품목별 기초·입고·출고·기말 수량과 금액
 * - by=place: 사용처별·품목별 출고 수량과 금액 (출고만 집계)
 * 금액 = 수량 × 기록된 단가, 단가가 없으면 품목 입고단가
 */
export default route({
  async GET(req, res) {
    const q = reportQuery.parse(req.query ?? {});
    const itemId = q.itemId ?? null;
    const place = q.by === 'place' ? q.place : null;
    const outOnly = q.by === 'place';
    const unit = q.group;
    const fmt = q.group === 'day' ? 'YYYY-MM-DD' : 'YYYY-MM';
    const sql = getSql();

    const summaryQuery =
      q.by === 'item'
        ? sql`
          WITH b AS (
            -- 기간 [t0, t1): 시작일 00:00 ~ 종료일 다음날 00:00 (한국 시간)
            SELECT (${q.from}::date)::timestamp AT TIME ZONE 'Asia/Seoul' AS t0,
                   ((${q.to}::date) + 1)::timestamp AT TIME ZONE 'Asia/Seoul' AS t1
          )
          SELECT i.id, i.name, i.location, (i.deleted_at IS NOT NULL) AS deleted,
                 COALESCE(SUM(m.delta) FILTER (WHERE m.created_at < b.t0), 0)::int AS opening,
                 COALESCE(SUM(m.delta) FILTER (WHERE m.created_at >= b.t0 AND m.delta > 0), 0)::int AS in_qty,
                 COALESCE(-SUM(m.delta) FILTER (WHERE m.created_at >= b.t0 AND m.delta < 0), 0)::int AS out_qty,
                 COALESCE(SUM(m.delta * COALESCE(m.unit_price, i.unit_cost))
                          FILTER (WHERE m.created_at >= b.t0 AND m.delta > 0), 0) AS in_amount,
                 COALESCE(-SUM(m.delta * COALESCE(m.unit_price, i.unit_cost))
                          FILTER (WHERE m.created_at >= b.t0 AND m.delta < 0), 0) AS out_amount,
                 COUNT(m.id) FILTER (WHERE m.created_at >= b.t0)::int AS count
            FROM items i
           CROSS JOIN b
            LEFT JOIN stock_movements m ON m.item_id = i.id AND m.created_at < b.t1
           WHERE (${itemId}::bigint IS NULL OR i.id = ${itemId}::bigint)
           GROUP BY i.id
          HAVING COALESCE(SUM(m.delta) FILTER (WHERE m.created_at < b.t0), 0) <> 0
              OR COUNT(m.id) FILTER (WHERE m.created_at >= b.t0) > 0
           ORDER BY i.name ASC, i.id ASC`
        : sql`
          WITH b AS (
            -- 기간 [t0, t1): 시작일 00:00 ~ 종료일 다음날 00:00 (한국 시간)
            SELECT (${q.from}::date)::timestamp AT TIME ZONE 'Asia/Seoul' AS t0,
                   ((${q.to}::date) + 1)::timestamp AT TIME ZONE 'Asia/Seoul' AS t1
          )
          SELECT m.usage_place AS place, i.id, i.name,
                 (-SUM(m.delta))::int AS out_qty,
                 -SUM(m.delta * COALESCE(m.unit_price, i.unit_cost)) AS out_amount,
                 COUNT(*)::int AS count
            FROM stock_movements m
            JOIN items i ON i.id = m.item_id
           CROSS JOIN b
           WHERE m.created_at >= b.t0 AND m.created_at < b.t1
             AND m.delta < 0
             AND (${itemId}::bigint IS NULL OR m.item_id = ${itemId}::bigint)
             AND (${place}::text IS NULL OR m.usage_place = ${place}::text)
           GROUP BY m.usage_place, i.id
           ORDER BY m.usage_place ASC, i.name ASC`;

    const bucketQuery = sql`
      WITH b AS (
        SELECT (${q.from}::date)::timestamp AT TIME ZONE 'Asia/Seoul' AS t0,
               ((${q.to}::date) + 1)::timestamp AT TIME ZONE 'Asia/Seoul' AS t1
      )
      SELECT to_char(date_trunc(${unit}::text, m.created_at AT TIME ZONE 'Asia/Seoul'), ${fmt}::text) AS bucket,
             COALESCE(SUM(m.delta) FILTER (WHERE m.delta > 0), 0)::int AS in_qty,
             COALESCE(-SUM(m.delta) FILTER (WHERE m.delta < 0), 0)::int AS out_qty,
             COALESCE(SUM(m.delta * COALESCE(m.unit_price, i.unit_cost)) FILTER (WHERE m.delta > 0), 0) AS in_amount,
             COALESCE(-SUM(m.delta * COALESCE(m.unit_price, i.unit_cost)) FILTER (WHERE m.delta < 0), 0) AS out_amount,
             COUNT(*)::int AS count
        FROM stock_movements m
        JOIN items i ON i.id = m.item_id
       CROSS JOIN b
       WHERE m.created_at >= b.t0 AND m.created_at < b.t1
         AND (${outOnly}::boolean = false OR m.delta < 0)
         AND (${itemId}::bigint IS NULL OR m.item_id = ${itemId}::bigint)
         AND (${place}::text IS NULL OR m.usage_place = ${place}::text)
       GROUP BY 1
       ORDER BY 1`;

    const detailQuery =
      q.detail === '1'
        ? sql`
          WITH b AS (
            -- 기간 [t0, t1): 시작일 00:00 ~ 종료일 다음날 00:00 (한국 시간)
            SELECT (${q.from}::date)::timestamp AT TIME ZONE 'Asia/Seoul' AS t0,
                   ((${q.to}::date) + 1)::timestamp AT TIME ZONE 'Asia/Seoul' AS t1
          )
          SELECT m.id, m.created_at, m.delta, m.usage_place, m.memo, m.unit_price,
                 i.id AS item_id, i.name AS item_name, u.name AS user_name
            FROM stock_movements m
            JOIN items i ON i.id = m.item_id
            JOIN users u ON u.id = m.user_id
           CROSS JOIN b
           WHERE m.created_at >= b.t0 AND m.created_at < b.t1
             AND (${outOnly}::boolean = false OR m.delta < 0)
             AND (${itemId}::bigint IS NULL OR m.item_id = ${itemId}::bigint)
             AND (${place}::text IS NULL OR m.usage_place = ${place}::text)
           ORDER BY m.created_at ASC, m.id ASC
           LIMIT 2001`
        : null;

    const [summary, buckets, details] = await Promise.all([
      summaryQuery,
      bucketQuery,
      detailQuery ?? Promise.resolve(null),
    ]);

    ok(res, {
      query: { from: q.from, to: q.to, group: q.group, by: q.by, itemId, place },
      rows:
        q.by === 'item'
          ? summary.map((r) => ({
              itemId: Number(r.id),
              name: r.name,
              location: r.location,
              deleted: r.deleted,
              opening: r.opening,
              inQty: r.in_qty,
              outQty: r.out_qty,
              closing: r.opening + r.in_qty - r.out_qty,
              inAmount: num(r.in_amount),
              outAmount: num(r.out_amount),
              count: r.count,
            }))
          : summary.map((r) => ({
              place: r.place,
              itemId: Number(r.id),
              name: r.name,
              outQty: r.out_qty,
              outAmount: num(r.out_amount),
              count: r.count,
            })),
      buckets: buckets.map((b) => ({
        bucket: b.bucket,
        inQty: b.in_qty,
        outQty: b.out_qty,
        inAmount: num(b.in_amount),
        outAmount: num(b.out_amount),
        count: b.count,
      })),
      details: details
        ? {
            truncated: details.length > 2000,
            rows: details.slice(0, 2000).map((d) => ({
              id: Number(d.id),
              createdAt: d.created_at,
              itemId: Number(d.item_id),
              itemName: d.item_name,
              delta: d.delta,
              usagePlace: d.usage_place,
              memo: d.memo,
              unitPrice: d.unit_price === null ? null : Number(d.unit_price),
              userName: d.user_name,
            })),
          }
        : null,
    });
  },
});
