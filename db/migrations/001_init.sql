-- 001: 초기 스키마 (users, items, stock_movements)

CREATE TABLE users (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(50)  NOT NULL,
  email      VARCHAR(255) UNIQUE,
  role       VARCHAR(20)  NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE items (
  id           BIGSERIAL     PRIMARY KEY,
  name         VARCHAR(100)  NOT NULL CHECK (length(btrim(name)) > 0),
  location     VARCHAR(100),
  unit_cost    NUMERIC(15,2) NOT NULL CHECK (unit_cost >= 0),
  quantity     INTEGER       NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  min_quantity INTEGER       NOT NULL DEFAULT 0 CHECK (min_quantity >= 0),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
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

CREATE INDEX stock_movements_item_created_idx ON stock_movements (item_id, created_at DESC);
CREATE INDEX items_name_idx ON items (name);
CREATE INDEX items_location_idx ON items (location);
