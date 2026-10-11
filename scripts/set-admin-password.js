// 관리자 비밀번호 설정 (최초 설정 또는 비밀번호 분실·잠금 시)
//
// 쉬운 방법: npm run admin:password
//   → 관리자를 자동으로 찾고, 비밀번호를 두 번 물어본다 (화면에는 * 로만 표시, 입력 기록에 안 남음)
// 직접 지정: npm run admin:password -- "관리자 이름" "새비밀번호"
//
// 설정하면 기존 로그인 세션은 모두 무효가 되고, 잠금도 풀린다. (.env.local의 DATABASE_URL에 적용)
import { createInterface } from 'node:readline/promises';
import { neon } from '@neondatabase/serverless';
import { hashPassword } from '../api/_lib/password.js';

const MIN_LENGTH = 8;

function fail(message) {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

/** 입력한 글자를 * 로 가려서 받는다 */
function askHidden(question) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          stdout.write('\n');
          resolve(value);
          return;
        }
        if (ch === '\u0003') {
          // Ctrl+C
          stdout.write('\n취소했습니다.\n');
          process.exit(130);
        }
        if (ch === '\u007f' || ch === '\b') {
          if (value.length) {
            value = value.slice(0, -1);
            stdout.write('\b \b');
          }
          continue;
        }
        value += ch;
        stdout.write('*');
      }
    };
    stdin.on('data', onData);
  });
}

if (!process.env.DATABASE_URL) {
  fail('DATABASE_URL이 설정되지 않았습니다. .env.local 파일이 저장되어 있는지 확인하세요.');
}
const sql = neon(process.env.DATABASE_URL);

let [name, password] = process.argv.slice(2);
const interactive = !password;
if (interactive && !process.stdin.isTTY) {
  fail('VS Code 터미널에서 직접 실행해 주세요. (비밀번호를 물어보려면 터미널이 필요합니다)');
}

// 관리자 이름: 지정하지 않으면 DB에서 찾는다
if (!name) {
  const admins = await sql`
    SELECT name FROM users WHERE role = 'admin' AND deleted_at IS NULL ORDER BY created_at, name`;
  if (admins.length === 0) fail('DB에 관리자가 없습니다. 먼저 npm run db:seed 를 실행하세요.');
  if (admins.length === 1) {
    name = admins[0].name;
  } else {
    console.log('관리자 목록:');
    admins.forEach((a, i) => console.log(`  ${i + 1}. ${a.name}`));
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const pick = Number((await rl.question('비밀번호를 설정할 관리자 번호: ')).trim());
    rl.close();
    if (!Number.isInteger(pick) || pick < 1 || pick > admins.length)
      fail('번호가 올바르지 않습니다.');
    name = admins[pick - 1].name;
  }
}

if (interactive) {
  console.log(
    `\n'${name}' 관리자의 새 비밀번호를 정합니다. (${MIN_LENGTH}자 이상, 영문·숫자 권장)`,
  );
  password = await askHidden('새 비밀번호: ');
  if (password.length < MIN_LENGTH) fail(`비밀번호는 ${MIN_LENGTH}자 이상이어야 합니다.`);
  const again = await askHidden('한 번 더 입력: ');
  if (again !== password) fail('두 번 입력한 비밀번호가 다릅니다. 다시 실행해 주세요.');
} else if (password.length < MIN_LENGTH) {
  fail(`비밀번호는 ${MIN_LENGTH}자 이상이어야 합니다.`);
}

const rows = await sql`
  UPDATE users
     SET password_hash = ${await hashPassword(password)}, password_changed_at = now(),
         failed_logins = 0, locked_until = NULL
   WHERE name = ${name} AND role = 'admin' AND deleted_at IS NULL
  RETURNING name`;

if (rows.length === 0) {
  fail(`'${name}' 이름의 관리자를 찾을 수 없습니다. 이름을 확인하거나 이름 없이 실행해 보세요.`);
}
console.log(
  `\n✓ '${rows[0].name}' 관리자 비밀번호를 설정했습니다. 웹앱에서 이 비밀번호로 로그인하세요.`,
);
