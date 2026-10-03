-- 003: 품목 사진 (품목 등록·입고 시에만 추가). 원본(긴 변 1280px)과 미리보기(320px) JPEG 저장

CREATE TABLE item_photos (
  id          BIGSERIAL   PRIMARY KEY,
  item_id     BIGINT      NOT NULL REFERENCES items (id) ON DELETE RESTRICT,
  movement_id BIGINT      REFERENCES stock_movements (id) ON DELETE RESTRICT,
  user_id     UUID        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  mime        VARCHAR(20) NOT NULL DEFAULT 'image/jpeg' CHECK (mime = 'image/jpeg'),
  image       BYTEA       NOT NULL,
  thumb       BYTEA       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX item_photos_item_created_idx ON item_photos (item_id, created_at DESC);
CREATE INDEX item_photos_movement_idx ON item_photos (movement_id);
