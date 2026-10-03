// db/migrations/*.sql을 순번대로 적용한다. 적용 기록은 schema_migrations 테이블에 남긴다.
// 사용: npm run db:migrate   (시드 포함: npm run db:seed)
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from '@neondatabase/serverless';

const root = join(import.meta.dirname, '..', 'db');
const withSeed = process.argv.includes('--seed');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL이 설정되지 않았습니다. .env.local을 확인하세요.');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const { rows } = await pool.query('SELECT name FROM schema_migrations');
  const applied = new Set(rows.map((r) => r.name));

  const files = (await readdir(join(root, 'migrations'))).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    if (applied.has(file)) continue;
    const text = await readFile(join(root, 'migrations', file), 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(text);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      await client.query('COMMIT');
      console.log(`적용: ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  if (withSeed) {
    await pool.query(await readFile(join(root, 'seed.sql'), 'utf8'));
    console.log('시드 데이터 적용: db/seed.sql');
  }
  console.log('완료');
} catch (err) {
  console.error('마이그레이션 실패:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
