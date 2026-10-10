import { getSql } from '../../../_lib/db.js';
import { requireUser } from '../../../_lib/auth.js';
import { HttpError, ok, route } from '../../../_lib/response.js';
import { idParam, photoCreate } from '../../../_lib/validate.js';

/** 품목 사진 목록 (최신순). 이미지는 /api/photos/:id 로 불러온다. */
export default route({
  async GET(req, res) {
    const id = idParam.parse(req.query.id);
    const sql = getSql();
    const exists = await sql`SELECT 1 FROM items WHERE id = ${id}`;
    if (exists.length === 0) throw new HttpError(404, 'ITEM_NOT_FOUND', '품목을 찾을 수 없습니다.');
    const rows = await sql`
      SELECT p.id, p.movement_id, p.created_at, u.name AS user_name
        FROM item_photos p
        JOIN users u ON u.id = p.user_id
       WHERE p.item_id = ${id}
       ORDER BY p.created_at DESC, p.id DESC
       LIMIT 50`;
    ok(
      res,
      rows.map((r) => ({
        id: Number(r.id),
        movementId: r.movement_id === null ? null : Number(r.movement_id),
        createdAt: r.created_at,
        userName: r.user_name,
      })),
    );
  },

  /** 사진 등록·변경: 새 사진을 추가하면 그 사진이 대표 사진이 된다 (이전 사진은 보존) */
  async POST(req, res) {
    const user = await requireUser(req);
    const id = idParam.parse(req.query.id);
    const { photo } = photoCreate.parse(req.body ?? {});
    const sql = getSql();
    const rows = await sql`
      INSERT INTO item_photos (item_id, user_id, image, thumb)
      SELECT i.id, ${user.id}::uuid, decode(${photo.image}::text, 'base64'),
             decode(${photo.thumb}::text, 'base64')
        FROM items i
       WHERE i.id = ${id} AND i.deleted_at IS NULL
      RETURNING id, created_at`;
    if (rows.length === 0) throw new HttpError(404, 'ITEM_NOT_FOUND', '품목을 찾을 수 없습니다.');
    ok(
      res,
      { id: Number(rows[0].id), itemId: id, createdAt: rows[0].created_at, userName: user.name },
      201,
    );
  },
});
