'use strict';

/**
 * app.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Creates and configures the Express application.
 *
 * Responsibilities:
 *  - Apply global middleware (CORS, JSON parser, request logger)
 *  - Mount feature routers
 *  - Register 404 and error-handling middleware (must be last)
 *
 * The HTTP server itself is created in server.js so that Socket.IO can
 * attach to the same server instance without circular dependencies.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const env = require('./config/env');
const ordersRouter = require('./routes/ordersRoutes');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();

// ── Global middleware ─────────────────────────────────────────────────────────

// CORS — allow configured origins
app.use(cors({ origin: env.CORS_ORIGIN }));

// Parse incoming JSON bodies
app.use(express.json());

// Parse URL-encoded bodies (for form submissions if needed)
app.use(express.urlencoded({ extended: true }));

// HTTP request logger (skip in test environments)
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// ── Static client (serves client/index.html at /) ─────────────────────────────
const clientPath = path.join(__dirname, '..', 'client');
app.use(express.static(clientPath));

// Serve index.html for the root route explicitly
app.get('/', (_req, res) => {
  res.sendFile(path.join(clientPath, 'index.html'));
});

// ── Feature routes ────────────────────────────────────────────────────────────
app.use('/api/orders', ordersRouter);

// ── 404 handler (must be after all valid routes) ──────────────────────────────
app.use(notFoundHandler);

// ── Centralised error handler (must be last) ──────────────────────────────────
app.use(errorHandler);

module.exports = app;
