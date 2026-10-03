-- 004: 관리자 비밀번호 로그인, 사용자·품목 삭제 (이력 보존을 위해 삭제 표시만)

ALTER TABLE users
  ADD COLUMN password_hash       TEXT,
  ADD COLUMN password_changed_at TIMESTAMPTZ,
  ADD COLUMN failed_logins       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN locked_until        TIMESTAMPTZ,
  ADD COLUMN deleted_at          TIMESTAMPTZ;

ALTER TABLE items
  ADD COLUMN deleted_at TIMESTAMPTZ;
