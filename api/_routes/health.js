import { getSql } from '../_lib/db.js';
import { ok, route } from '../_lib/response.js';

/**
 * 배포 점검: GET /api/health
 * 환경변수가 들어 있는지, DB에 연결되는지, 테이블이 있는지 알려준다.
 * 비밀값(주소·키)이나 원래 오류 문구는 내보내지 않고, 원인 분류만 돌려준다.
 */
function classify(err) {
  const msg = String(err?.message ?? '');
  if (/connection string format|Invalid URL|invalid url/i.test(msg)) {
    return '주소 형식 오류 — 값이 postgresql:// 로 시작하는지, 앞에 DATABASE_URL= 이나 따옴표가 붙지 않았는지 확인';
  }
  if (/password authentication failed|authentication/i.test(msg)) {
    return '비밀번호 오류 — Neon에서 주소를 다시 복사해 넣기';
  }
  if (/ENOTFOUND|getaddrinfo|fetch failed|ECONNREFUSED/i.test(msg)) {
    return '서버 주소(호스트) 오류 — Neon에서 주소를 다시 복사해 넣기';
  }
  if (/does not exist/i.test(msg) && /database/i.test(msg)) {
    return '데이터베이스 이름 오류 — 주소 끝의 /neondb 확인';
  }
  return '연결 실패 — Vercel Logs에서 오류 확인';
}

export default route({
  async GET(_req, res) {
    const url = process.env.DATABASE_URL ?? '';
    const result = {
      databaseUrl: url ? (url.trim().startsWith('postgres') ? '있음' : '있음(형식 의심)') : '없음',
      sessionSecret:
        (process.env.SESSION_SECRET ?? '').length >= 32 ? '있음' : '없음 또는 32자 미만',
      database: '확인 안 함',
    };

    if (!url) {
      result.database = 'DATABASE_URL 환경변수 없음 — Vercel에 넣고 Redeploy';
    } else {
      try {
        const sql = getSql();
        await sql`SELECT 1`;
        const [t] = await sql`SELECT to_regclass('public.users') AS t`;
        if (!t.t) result.database = '연결됨, 테이블 없음 — npm run db:seed 필요';
        else {
          const [u] = await sql`
            SELECT count(*)::int AS users,
                   count(*) FILTER (WHERE role = 'admin' AND password_hash IS NOT NULL)::int AS admins
              FROM users WHERE deleted_at IS NULL`;
          result.database = '정상';
          result.users = u.users;
          result.adminPassword = u.admins > 0 ? '설정됨' : '없음 — npm run admin:password 필요';
        }
      } catch (err) {
        console.error('[health]', err);
        result.database = classify(err);
      }
    }
    ok(res, result);
  },
});
