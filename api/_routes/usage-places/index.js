import { getSql } from '../../_lib/db.js';
import { requireAdmin } from '../../_lib/auth.js';
import { ok, route } from '../../_lib/response.js';
import { usagePlaceCreate } from '../../_lib/validate.js';

const toPlace = (r) => ({ id: Number(r.id), name: r.name });

export default route({
  async GET(_req, res) {
    const sql = getSql();
    const rows = await sql`SELECT id, name FROM usage_places ORDER BY name ASC`;
    ok(res, rows.map(toPlace));
  },

  /** 사용처 등록 (관리자 전용). 이미 있으면 기존 항목을 그대로 돌려준다. */
  async POST(req, res) {
    await requireAdmin(req);
    const { name } = usagePlaceCreate.parse(req.body ?? {});
    const sql = getSql();
    const inserted = await sql`
      INSERT INTO usage_places (name) VALUES (${name})
      ON CONFLICT (name) DO NOTHING
      RETURNING id, name`;
    if (inserted.length === 1) return ok(res, toPlace(inserted[0]), 201);
    const existing = await sql`SELECT id, name FROM usage_places WHERE name = ${name}`;
    ok(res, toPlace(existing[0]));
  },
});
