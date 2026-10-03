// API 테스트 전체 실행: npm run test:api
// 각 파일을 별도 프로세스로 실행한다 (파일마다 새 메모리 DB). Neon 연결 없이 동작한다.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';

const dir = import.meta.dirname;
const root = path.resolve(dir, '../..');
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.test.js'))
  .sort();

let failed = 0;
for (const file of files) {
  console.log(`\n▶ ${file}`);
  const r = spawnSync(
    process.execPath,
    ['--import', './tests/api/register.mjs', path.join('tests', 'api', file)],
    { cwd: root, stdio: 'inherit' },
  );
  if (r.status !== 0) failed++;
}

console.log(failed ? `\n✗ ${failed}개 파일 실패` : `\n✓ ${files.length}개 파일 모두 통과`);
process.exitCode = failed ? 1 : 0;
