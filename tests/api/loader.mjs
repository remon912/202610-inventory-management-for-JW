// API 테스트용 모듈 로더: api/_lib/db.js(Neon)를 내장 DB(PGlite)로 바꿔 끼운다.
const replacement = new URL('./db-pglite.js', import.meta.url).href;

export async function resolve(specifier, context, nextResolve) {
  const result = await nextResolve(specifier, context);
  if (result.url.endsWith('/api/_lib/db.js')) return { ...result, url: replacement };
  return result;
}
