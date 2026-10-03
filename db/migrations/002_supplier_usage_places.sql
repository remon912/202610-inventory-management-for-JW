-- 002: 품목 구입처, 사용처 목록(출고 시 등록된 사용처만 선택)

ALTER TABLE items ADD COLUMN supplier VARCHAR(100);

CREATE TABLE usage_places (
  id         BIGSERIAL    PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE CHECK (length(btrim(name)) > 0),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- 기존 출고 이력의 사용처를 목록으로 옮긴다
INSERT INTO usage_places (name)
SELECT DISTINCT btrim(usage_place)
  FROM stock_movements
 WHERE delta < 0 AND btrim(usage_place) <> ''
ON CONFLICT (name) DO NOTHING;
