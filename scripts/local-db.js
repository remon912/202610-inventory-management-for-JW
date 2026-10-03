// 로컬 미리보기 전용 DB: Neon 대신 PGlite(내장 PostgreSQL)를 사용한다.
// api/_lib/db.js의 getSql()과 같은 인터페이스(태그드 템플릿, 파라미터 바인딩)를 제공한다.
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { hashPassword } from '../api/_lib/password.js';

const root = path.resolve(import.meta.dirname, '..');
const dataDir = path.join(root, '.local-db');
const migrationsDir = path.join(root, 'db', 'migrations');

/** db/migrations/*.sql 중 미적용 파일을 순서대로 적용 (scripts/migrate.js와 같은 규칙) */
async function migrate(pg) {
  await pg.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const { rows } = await pg.query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name));

  // 마이그레이션 기록 도입 전에 schema.sql로 만든 로컬 DB는 001이 이미 적용된 상태
  if (applied.size === 0) {
    const { rows: t } = await pg.query(`SELECT to_regclass('public.items') AS t`);
    if (t[0].t) {
      await pg.query(`INSERT INTO schema_migrations (name) VALUES ('001_init.sql')`);
      applied.add('001_init.sql');
    }
  }

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const text = await readFile(path.join(migrationsDir, file), 'utf8');
    await pg.transaction(async (tx) => {
      await tx.exec(text);
      await tx.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    });
    console.log(`[local-db] 마이그레이션 적용: ${file}`);
  }
}

/** 로컬 미리보기 전용: 비밀번호가 없는 관리자에게 초기 비밀번호를 설정한다 */
async function ensureAdminPassword(pg) {
  const { rows } = await pg.query(
    `SELECT id, name FROM users WHERE role = 'admin' AND password_hash IS NULL AND deleted_at IS NULL`,
  );
  if (rows.length === 0) return;
  const initial = process.env.LOCAL_ADMIN_PASSWORD || 'admin1234';
  for (const u of rows) {
    await pg.query(
      'UPDATE users SET password_hash = $1, password_changed_at = now() WHERE id = $2',
      [await hashPassword(initial), u.id],
    );
    console.log(
      `[local-db] 관리자 '${u.name}' 초기 비밀번호: ${initial} (관리 화면에서 변경하세요)`,
    );
  }
}

async function init() {
  const fresh = !existsSync(dataDir);
  const pg = new PGlite(dataDir);
  await pg.waitReady;
  await migrate(pg);
  if (fresh) {
    await pg.exec(await readFile(path.join(root, 'db', 'seed.sql'), 'utf8'));
    await pg.exec(await readFile(path.join(root, 'scripts', 'local-sample.sql'), 'utf8'));
    console.log('[local-db] 새 로컬 DB를 만들고 샘플 데이터를 넣었습니다: .local-db/');
  }
  await ensureAdminPassword(pg);
  return pg;
}

// 모듈이 다시 로드되어도 같은 인스턴스를 쓰도록 전역에 보관
globalThis.__inventoryLocalDb ??= init();

async function sql(strings, ...values) {
  const pg = await globalThis.__inventoryLocalDb;
  const text = strings.reduce((acc, s, i) => acc + s + (i < values.length ? `$${i + 1}` : ''), '');
  const result = await pg.query(text, values);
  return result.rows;
}

export function getSql() {
  return sql;
}
