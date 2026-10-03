-- 전체 스키마 (현재 상태). 변경은 db/migrations/에 순번 파일로 추가하고 이 파일도 함께 갱신한다.

CREATE TABLE users (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(50)  NOT NULL,
  email      VARCHAR(255) UNIQUE,
  role       VARCHAR(20)  NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  -- 관리자 로그인 (004)
  password_hash       TEXT,
  password_changed_at TIMESTAMPTZ,
  failed_logins       INTEGER NOT NULL DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  deleted_at          TIMESTAMPTZ
);

CREATE TABLE items (
  id           BIGSERIAL     PRIMARY KEY,
  name         VARCHAR(100)  NOT NULL CHECK (length(btrim(name)) > 0),
  location     VARCHAR(100),
  supplier     VARCHAR(100),
  unit_cost    NUMERIC(15,2) NOT NULL CHECK (unit_cost >= 0),
  quantity     INTEGER       NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_quantity INTEGER       NOT NULL DEFAULT 0 CHECK (min_quantity >= 0),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);

CREATE TABLE stock_movements (
  id          BIGSERIAL     PRIMARY KEY,
  item_id     BIGINT        NOT NULL REFERENCES items (id) ON DELETE RESTRICT,
  user_id     UUID          NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  delta       INTEGER       NOT NULL CHECK (delta <> 0),
  usage_place VARCHAR(100)  NOT NULL,
  memo        VARCHAR(500),
  unit_price  NUMERIC(15,2) CHECK (unit_price >= 0),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE usage_places (
  id         BIGSERIAL    PRIMARY KEY,
  name       VARCHAR(100) NOT NULL UNIQUE CHECK (length(btrim(name)) > 0),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX stock_movements_item_created_idx ON stock_movements (item_id, created_at DESC);
CREATE INDEX items_name_idx ON items (name);
CREATE INDEX items_location_idx ON items (location);

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
