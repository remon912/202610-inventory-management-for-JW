import { getAdminSession } from '../../_lib/auth.js';
import { ok, route } from '../../_lib/response.js';

/** 현재 관리자 세션. 로그인하지 않았으면 { user: null } */
export default route({
  async GET(req, res) {
    ok(res, { user: await getAdminSession(req) });
  },
});
