const { Pool, types } = require('pg');

// Return DATE columns as plain 'YYYY-MM-DD' strings. The default parses them
// into a JS Date at local midnight, which shifts the day when converted to UTC.
types.setTypeParser(1082, (v) => v);
const config = require('./config');

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: true } : false,
  max: 10,
});

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  monthly_budget NUMERIC(12,2) NOT NULL DEFAULT 10000,
  currency      TEXT NOT NULL DEFAULT 'INR',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category     TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  merchant     TEXT NOT NULL DEFAULT '',
  spent_on     DATE NOT NULL DEFAULT CURRENT_DATE,
  receipt_blob TEXT,
  source       TEXT NOT NULL DEFAULT 'manual',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, spent_on);

-- One row per (user, month, threshold) so each alert fires once a month.
CREATE TABLE IF NOT EXISTS budget_alerts (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month      TEXT NOT NULL,
  threshold  NUMERIC(4,2) NOT NULL,
  spent      NUMERIC(12,2) NOT NULL,
  budget     NUMERIC(12,2) NOT NULL,
  status     TEXT NOT NULL DEFAULT 'queued',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at    TIMESTAMPTZ,
  UNIQUE (user_id, month, threshold)
);
`;

async function migrate() {
  await pool.query(SCHEMA);
}

module.exports = { pool, migrate };
