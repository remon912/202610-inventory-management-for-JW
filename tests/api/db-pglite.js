// 테스트 전용 DB: 메모리 안의 PostgreSQL(PGlite). api/_lib/db.js와 같은 getSql() 인터페이스.
import { PGlite } from '@electric-sql/pglite';

export const pg = new PGlite();

// neon 태그드 템플릿과 같은 방식: 값은 $n 파라미터로 바인딩
export const sqlTag = async (strings, ...values) => {
  const text = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ''), '');
  const r = await pg.query(text, values);
  return r.rows;
};

export function getSql() {
  return sqlTag;
}
