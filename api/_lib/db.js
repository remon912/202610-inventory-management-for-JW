import { neon } from '@neondatabase/serverless';

let sql;

/** Neon HTTP 클라이언트 (태그드 템플릿으로 파라미터 바인딩) */
export function getSql() {
  if (!sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    sql = neon(url);
  }
  return sql;
}
