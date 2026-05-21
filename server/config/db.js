'use strict';

/**
 * db.js
 * Exports two PostgreSQL clients:
 *  - pool        → shared connection pool used by all HTTP request handlers
 *  - createListenerClient() → creates a dedicated, long-lived client used
 *    exclusively for LISTEN/NOTIFY so it is never returned to the pool
 *    or reused for regular queries.
 */

const { Pool, Client } = require('pg');
const env = require('./env');

// ── Connection Pool (for REST API handlers) ─────────────────────────────────
const pool = new Pool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  // Keep a reasonable number of connections alive
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// Log pool-level errors (e.g. dropped connections)
pool.on('error', (err) => {
  console.error('[DB Pool] Unexpected error on idle client:', err.message);
});

// ── Dedicated Listener Client Factory ──────────────────────────────────────
/**
 * Creates and connects a brand-new pg.Client reserved for LISTEN/NOTIFY.
 * This client must NEVER be used for regular queries.
 *
 * @returns {Promise<import('pg').Client>}
 */
async function createListenerClient() {
  const client = new Client({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  });

  await client.connect();
  return client;
}

module.exports = { pool, createListenerClient };
