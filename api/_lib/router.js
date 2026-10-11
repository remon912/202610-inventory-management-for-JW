// API 라우팅 표: 모든 /api/* 요청을 함수 하나(api/router.js)에서 나눠 처리한다.
// Vercel 무료(Hobby) 플랜은 배포당 서버 함수가 12개까지라, 파일마다 함수를 만들지 않고 하나로 합친다.
// 처리 코드는 api/_routes/ 에 있다 (밑줄로 시작하는 폴더는 Vercel이 함수로 만들지 않음).
import { fail } from './response.js';
import items from '../_routes/items/index.js';
import itemsBulk from '../_routes/items/bulk.js';
import itemById from '../_routes/items/[id].js';
import itemMovements from '../_routes/items/[id]/movements.js';
import itemPhotos from '../_routes/items/[id]/photos.js';
import photoById from '../_routes/photos/[id].js';
import movements from '../_routes/movements.js';
import users from '../_routes/users/index.js';
import userById from '../_routes/users/[id].js';
import usagePlaces from '../_routes/usage-places/index.js';
import usagePlaceById from '../_routes/usage-places/[id].js';
import login from '../_routes/auth/login.js';
import logout from '../_routes/auth/logout.js';
import me from '../_routes/auth/me.js';
import password from '../_routes/auth/password.js';
import reports from '../_routes/reports.js';
import health from '../_routes/health.js';

// [주소 패턴, 처리 함수] — 위에서부터 먼저 맞는 것을 쓴다. (:id는 req.query.id로 전달)
export const ROUTES = [
  [/^\/api\/items\/?$/, items],
  [/^\/api\/items\/bulk\/?$/, itemsBulk],
  [/^\/api\/items\/([^/]+)\/movements\/?$/, itemMovements],
  [/^\/api\/items\/([^/]+)\/photos\/?$/, itemPhotos],
  [/^\/api\/items\/([^/]+)\/?$/, itemById],
  [/^\/api\/photos\/([^/]+)\/?$/, photoById],
  [/^\/api\/movements\/?$/, movements],
  [/^\/api\/users\/?$/, users],
  [/^\/api\/users\/([^/]+)\/?$/, userById],
  [/^\/api\/usage-places\/?$/, usagePlaces],
  [/^\/api\/usage-places\/([^/]+)\/?$/, usagePlaceById],
  [/^\/api\/auth\/login\/?$/, login],
  [/^\/api\/auth\/logout\/?$/, logout],
  [/^\/api\/auth\/me\/?$/, me],
  [/^\/api\/auth\/password\/?$/, password],
  [/^\/api\/reports\/?$/, reports],
  [/^\/api\/health\/?$/, health], // 배포 점검 (비밀값 없이 상태만)
];

/**
 * pathname(예: /api/items/3/photos)에 맞는 처리 함수를 찾아 실행한다.
 * req.query에는 주소의 검색 조건이 들어 있어야 한다. 주소 속 :id는 req.query.id로 넣는다.
 */
export async function dispatch(req, res, pathname) {
  for (const [pattern, handler] of ROUTES) {
    const m = pathname.match(pattern);
    if (!m) continue;
    if (m[1] !== undefined) req.query = { ...req.query, id: decodeURIComponent(m[1]) };
    return handler(req, res);
  }
  res.setHeader('Cache-Control', 'no-store');
  return fail(res, 404, 'NOT_FOUND', '없는 API입니다.');
}
