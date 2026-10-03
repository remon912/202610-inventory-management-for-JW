-- 간이 사용자 선택 방식용 초기 사용자 (실제 인원에 맞게 수정)
INSERT INTO users (name, email, role) VALUES
  ('관리자', 'admin@example.com', 'admin'),
  ('김재고', 'kim@example.com', 'member'),
  ('이창고', 'lee@example.com', 'member')
ON CONFLICT (email) DO NOTHING;
