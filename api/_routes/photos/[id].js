import { getSql } from '../../_lib/db.js';
import { requireAdmin } from '../../_lib/auth.js';
import { HttpError, ok, route } from '../../_lib/response.js';
import { idParam } from '../../_lib/validate.js';

/**
 * 사진 이미지 반환. GET /api/photos/:id (원본) · /api/photos/:id?size=thumb (미리보기)
 * 사진은 수정되지 않으므로 브라우저가 오래 캐시하게 한다.
 */
export default route({
  async GET(req, res) {
    const id = idParam.parse(req.query.id);
    const thumb = req.query.size === 'thumb';
    const sql = getSql();
    const rows = thumb
      ? await sql`SELECT mime, encode(thumb, 'base64') AS data FROM item_photos WHERE id = ${id}`
      : await sql`SELECT mime, encode(image, 'base64') AS data FROM item_photos WHERE id = ${id}`;
    if (rows.length === 0) throw new HttpError(404, 'PHOTO_NOT_FOUND', '사진을 찾을 수 없습니다.');

    const body = Buffer.from(rows[0].data, 'base64');
    res.statusCode = 200;
    res.setHeader('Content-Type', rows[0].mime);
    res.setHeader('Content-Length', String(body.length));
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end(body);
  },

  /**
   * 사진 삭제 (관리자 전용). 남은 사진 중 가장 최근 사진이 대표 사진이 된다.
   * 입출고 이력(수량)은 그대로이고, 그 입고 기록에 붙은 사진 표시만 사라진다.
   */
  async DELETE(req, res) {
    await requireAdmin(req);
    const id = idParam.parse(req.query.id);
    const sql = getSql();
    const rows = await sql`DELETE FROM item_photos WHERE id = ${id} RETURNING id, item_id`;
    if (rows.length === 0) throw new HttpError(404, 'PHOTO_NOT_FOUND', '사진을 찾을 수 없습니다.');
    const [next] = await sql`
      SELECT id FROM item_photos WHERE item_id = ${rows[0].item_id}
       ORDER BY created_at DESC, id DESC LIMIT 1`;
    ok(res, {
      id: Number(rows[0].id),
      itemId: Number(rows[0].item_id),
      photoId: next ? Number(next.id) : null, // 삭제 후 대표 사진
    });
  },
});
