// Vercel 서버 함수 진입점 (배포되는 함수는 이것 하나).
// vercel.json이 /api/* 요청을 /api/router?__path=* 로 넘기고, 여기서 api/_lib/router.js로 나눠 처리한다.
import { dispatch } from './_lib/router.js';

export default async function handler(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const { __path, ...query } = { ...Object.fromEntries(url.searchParams), ...req.query };

  // 원래 주소(/api/items/3)가 그대로 오면 그것을, 넘겨받은 주소(/api/router)면 __path를 쓴다
  let pathname = url.pathname;
  if (/^\/api\/router\/?$/.test(pathname)) {
    const sub = Array.isArray(__path) ? __path.join('/') : (__path ?? '');
    pathname = `/api/${sub}`;
  }

  req.query = query;
  return dispatch(req, res, pathname);
}
