import { createHmac, timingSafeEqual } from 'node:crypto';

// 관리자 세션: 서버가 서명한 토큰을 HttpOnly 쿠키로 보관 (브라우저 스크립트에서 읽을 수 없음)
const COOKIE = 'inv_admin';
const MAX_AGE_SEC = 12 * 60 * 60; // 12시간

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET is not set (32자 이상 필요)');
  return s;
}

const sign = (data) => createHmac('sha256', secret()).update(data).digest('base64url');

/** 비밀번호 변경 시각(v)을 넣어, 비밀번호를 바꾸면 기존 세션이 모두 무효가 되게 한다 */
export const passwordVersion = (changedAt) => (changedAt ? new Date(changedAt).getTime() : 0);

function createToken(user) {
  const payload = {
    uid: user.id,
    v: passwordVersion(user.password_changed_at),
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SEC,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${sign(data)}`;
}

/** 서명과 만료를 확인한 토큰 내용, 없거나 잘못되면 null */
export function readToken(req) {
  const raw = parseCookies(req.headers.cookie)[COOKIE];
  if (!raw) return null;
  const [data, sig] = raw.split('.');
  if (!data || !sig) return null;
  const expected = Buffer.from(sign(data));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (typeof payload.exp !== 'number' || payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function attrs(req, maxAge) {
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  return `Path=/api; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

export function setSessionCookie(req, res, user) {
  res.setHeader('Set-Cookie', `${COOKIE}=${createToken(user)}; ${attrs(req, MAX_AGE_SEC)}`);
}

export function clearSessionCookie(req, res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; ${attrs(req, 0)}`);
}
