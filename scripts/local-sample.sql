-- 로컬 미리보기용 샘플 품목. 초기 수량은 '초기 재고' 이력으로 남겨 원장 합계와 일치시킨다.
WITH u AS (
  SELECT id FROM users ORDER BY created_at, name LIMIT 1
),
it AS (
  INSERT INTO items (name, location, supplier, unit_cost, quantity, min_quantity) VALUES
    ('A4 복사용지 (500매)', '창고A-선반1', '한국제지 대리점', 4500, 42, 10),
    ('볼펜 (검정)', '창고A-선반2', '오피스디포', 350, 8, 20),
    ('토너 카트리지 HP 26A', '창고B-선반1', 'HP 공식몰', 89000, 3, 2),
    ('USB-C 충전 케이블 1m', '창고B-선반2', '전자랜드', 6900.5, 15, 5),
    ('종이컵 (1000개입)', '탕비실', '쿠팡', 12000, 0, 1),
    ('물티슈', '탕비실', '쿠팡', 2300, 24, 6)
  RETURNING id, quantity, unit_cost
)
INSERT INTO stock_movements (item_id, user_id, delta, usage_place, memo, unit_price)
SELECT it.id, u.id, it.quantity, '초기 재고', '샘플 데이터', it.unit_cost
  FROM it, u
 WHERE it.quantity > 0;

INSERT INTO usage_places (name) VALUES
  ('3층 회의실'), ('총무팀'), ('영업팀'), ('개발팀'), ('1층 로비')
ON CONFLICT (name) DO NOTHING;
