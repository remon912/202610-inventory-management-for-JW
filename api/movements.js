import { getSql } from './_lib/db.js';
import { requireUser } from './_lib/auth.js';
import { HttpError, ok, route } from './_lib/response.js';
import { movementCreate } from './_lib/validate.js';
import { recordMovement } from './_lib/movement.js';
import { toMovement } from './_lib/mappers.js';

export default route({
  async POST(req, res) {
    const user = await requireUser(req);
    const input = movementCreate.parse(req.body ?? {});
    const sql = getSql();

    // 출고는 등록된 사용처만 허용 (새 사용처는 POST /api/usage-places로 먼저 추가)
    if (input.delta < 0) {
      const places = await sql`SELECT 1 FROM usage_places WHERE name = ${input.usagePlace}`;
      if (places.length === 0) {
        throw new HttpError(
          400,
          'USAGE_PLACE_NOT_FOUND',
          '등록되지 않은 사용처입니다. 목록에서 선택하거나 + 추가로 먼저 등록해 주세요.',
        );
      }
    }

    const result = await recordMovement(sql, { ...input, userId: user.id });

    if (result.status === 'not_found') {
      throw new HttpError(404, 'ITEM_NOT_FOUND', '품목을 찾을 수 없습니다.');
    }
    if (result.status === 'insufficient') {
      const current = result.currentQuantity;
      throw new HttpError(
        409,
        'INSUFFICIENT_STOCK',
        `재고가 부족합니다. 현재 보유수량은 ${current.toLocaleString('ko-KR')}개입니다.`,
        { currentQuantity: current },
      );
    }

    ok(
      res,
      {
        movement: { ...toMovement(result.row), userName: user.name },
        item: { id: input.itemId, quantity: result.row.item_quantity },
      },
      201,
    );
  },
});
