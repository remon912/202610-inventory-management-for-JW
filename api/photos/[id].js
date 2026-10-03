import { getSql } from '../_lib/db.js';
import { HttpError, route } from '../_lib/response.js';
import { idParam } from '../_lib/validate.js';

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
});
