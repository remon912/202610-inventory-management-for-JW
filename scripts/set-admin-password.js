// 관리자 비밀번호 설정 (최초 설정 또는 비밀번호 분실 시)
// 사용: npm run admin:password -- "관리자" "새비밀번호8자이상"
// 기존 로그인 세션은 모두 무효가 되고, 잠금도 풀린다.
import { neon } from '@neondatabase/serverless';
import { hashPassword } from '../api/_lib/password.js';

const [name, password] = process.argv.slice(2);
if (!name || !password) {
  console.error('사용법: npm run admin:password -- "관리자 이름" "새 비밀번호"');
  process.exit(1);
}
if (password.length < 8) {
  console.error('비밀번호는 8자 이상이어야 합니다.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL이 설정되지 않았습니다. .env.local을 확인하세요.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const rows = await sql`
  UPDATE users
     SET password_hash = ${await hashPassword(password)}, password_changed_at = now(),
         failed_logins = 0, locked_until = NULL
   WHERE name = ${name} AND role = 'admin' AND deleted_at IS NULL
  RETURNING name`;

if (rows.length === 0) {
  console.error(`'${name}' 이름의 관리자를 찾을 수 없습니다.`);
  process.exitCode = 1;
} else {
  console.log(`'${rows[0].name}' 관리자 비밀번호를 설정했습니다.`);
}
