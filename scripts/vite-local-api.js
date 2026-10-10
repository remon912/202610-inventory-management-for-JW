// 로컬 미리보기 전용 Vite 플러그인 (npm run dev:local)
// 배포와 같은 진입점(api/router.js → api/_lib/router.js)으로 /api 요청을 처리하고, DB 모듈만 PGlite로 바꿔 끼운다.
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const localDb = path.join(root, 'scripts', 'local-db.js').replaceAll('\\', '/');
const apiDb = path.join(root, 'api', '_lib', 'db.js').replaceAll('\\', '/');

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return undefined;
  }
}

/** 로컬 미리보기용 세션 비밀키: 처음 한 번 만들어 파일로 보관 (Git 제외) */
function ensureSessionSecret() {
  if (process.env.SESSION_SECRET) return;
  const file = path.join(root, '.local-session-secret');
  if (!existsSync(file)) writeFileSync(file, randomBytes(32).toString('base64url'));
  process.env.SESSION_SECRET = readFileSync(file, 'utf8').trim();
}

export default function localApi() {
  ensureSessionSecret();
  return {
    name: 'inventory-local-api',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || !source.startsWith('.')) return;
      const target = path.resolve(path.dirname(decodeURI(importer)), source).replaceAll('\\', '/');
      if (target === apiDb) return localDb;
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        if (!url.pathname.startsWith('/api/')) return next();

        const send = (status, payload) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.end(JSON.stringify(payload));
        };
        req.query = Object.fromEntries(url.searchParams);
        req.body = await readJson(req);
        res.status = (code) => ((res.statusCode = code), res);
        res.json = (payload) => send(res.statusCode, payload);

        try {
          const mod = await server.ssrLoadModule(path.join(root, 'api', 'router.js'));
          await mod.default(req, res);
        } catch (err) {
          console.error('[local-api]', err);
          send(500, { ok: false, error: { code: 'INTERNAL_ERROR', message: '서버 오류' } });
        }
      });
    },
  };
}
