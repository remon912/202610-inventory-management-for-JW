import { ok, route } from '../_lib/response.js';
import { clearSessionCookie } from '../_lib/session.js';

export default route({
  async POST(req, res) {
    clearSessionCookie(req, res);
    ok(res, { user: null });
  },
});
