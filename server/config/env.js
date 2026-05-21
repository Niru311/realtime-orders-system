'use strict';

/**
 * env.js
 * Centralised environment configuration.
 * All environment variables are read ONCE here and exported as a plain object.
 * Never import `process.env` directly in application code — use this module instead.
 */

require('dotenv').config();

const env = {
  // ── Server ────────────────────────────────────────────────────────────────
  PORT: parseInt(process.env.PORT, 10) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // ── PostgreSQL ────────────────────────────────────────────────────────────
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT, 10) || 5432,
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_NAME: process.env.DB_NAME || 'realtime_orders',

  // ── CORS ──────────────────────────────────────────────────────────────────
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',

  // ── Socket.IO ─────────────────────────────────────────────────────────────
  SOCKET_PING_TIMEOUT: parseInt(process.env.SOCKET_PING_TIMEOUT, 10) || 60000,
  SOCKET_PING_INTERVAL: parseInt(process.env.SOCKET_PING_INTERVAL, 10) || 25000,
};

// Validate required variables in production
if (env.NODE_ENV === 'production') {
  const required = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  required.forEach((key) => {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  });
}

module.exports = env;
