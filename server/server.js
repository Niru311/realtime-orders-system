'use strict';

/**
 * server.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Application entry point.
 *
 * Boot sequence:
 *   1. Load environment variables (via config/env.js → dotenv)
 *   2. Create the Express app
 *   3. Wrap it in a native http.Server
 *   4. Attach Socket.IO to that server
 *   5. Start the PostgreSQL LISTEN/NOTIFY listener
 *   6. Bind the server to the configured port
 *
 * Shutdown sequence (SIGTERM / SIGINT):
 *   1. Stop accepting new connections
 *   2. Unlisten from the PG channel and close the listener client
 *   3. Drain the PG pool
 *   4. Exit cleanly
 * ─────────────────────────────────────────────────────────────────────────────
 */

const http = require('http');

// Load env FIRST so all subsequent imports see process.env
const env = require('./config/env');

const app = require('./app');
const { initSocket } = require('./websocket/socketManager');
const { startListening, stopListening } = require('./listeners/pgListener');
const { pool } = require('./config/db');

// ── Create HTTP server ────────────────────────────────────────────────────────
const httpServer = http.createServer(app);

// ── Attach Socket.IO ──────────────────────────────────────────────────────────
initSocket(httpServer);

// ── Graceful shutdown helper ──────────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Shutting down gracefully…`);

  // Stop accepting new HTTP connections
  httpServer.close(async () => {
    console.log('[Server] HTTP server closed');

    try {
      await stopListening();           // close PG listener client
      await pool.end();               // drain connection pool
      console.log('[Server] Database connections closed');
    } catch (err) {
      console.error('[Server] Error during shutdown:', err.message);
    } finally {
      process.exit(0);
    }
  });

  // Force-kill if shutdown hangs for more than 10 seconds
  setTimeout(() => {
    console.error('[Server] Forced exit after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Catch unhandled promise rejections — log and exit so the process doesn't
// run in an unknown state
process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled promise rejection:', reason);
  process.exit(1);
});

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  try {
    // Verify DB connectivity before binding the port
    await pool.query('SELECT 1');
    console.log('[Server] PostgreSQL connection pool ready');

    // Start the LISTEN/NOTIFY bridge
    await startListening();

    // Bind the HTTP server
    httpServer.listen(env.PORT, () => {
      console.log('─────────────────────────────────────────────────────');
      console.log(` 🚀  Realtime Orders Server`);
      console.log(`     Environment : ${env.NODE_ENV}`);
      console.log(`     HTTP        : http://localhost:${env.PORT}`);
      console.log(`     Socket.IO   : ws://localhost:${env.PORT}`);
      console.log(`     Health      : http://localhost:${env.PORT}/health`);
      console.log('─────────────────────────────────────────────────────');
    });
  } catch (err) {
    console.error('[Server] Startup failed:', err.message);
    process.exit(1);
  }
}

start();
