'use strict';

/**
 * errorHandler.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralised Express error-handling middleware.
 *
 * Must be registered LAST in app.js (after all routes) so that errors
 * propagated via next(err) reach here.
 *
 * Features:
 *  - Maps known error types to appropriate HTTP status codes
 *  - Hides internal stack traces in production
 *  - Returns a consistent JSON error envelope
 * ─────────────────────────────────────────────────────────────────────────────
 */

const env = require('../config/env');

/**
 * Map specific error codes / names to HTTP status codes.
 *
 * @param {Error} err
 * @returns {number}
 */
function resolveStatusCode(err) {
  // Explicit status attached to the error object
  if (err.status && Number.isInteger(err.status)) return err.status;
  if (err.statusCode && Number.isInteger(err.statusCode)) return err.statusCode;

  // PostgreSQL unique-violation → 409 Conflict
  if (err.code === '23505') return 409;
  // PostgreSQL foreign-key violation → 422 Unprocessable Entity
  if (err.code === '23503') return 422;
  // PostgreSQL not-null / check constraint → 400 Bad Request
  if (err.code === '23502' || err.code === '23514') return 400;

  return 500;
}

/**
 * Express error-handling middleware (4-argument signature required).
 *
 * @param {Error} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const status = resolveStatusCode(err);
  const isProduction = env.NODE_ENV === 'production';

  // Always log the full error server-side
  console.error(`[Error] ${req.method} ${req.originalUrl} → ${status}: ${err.message}`);
  if (!isProduction) console.error(err.stack);

  res.status(status).json({
    success: false,
    error: {
      message: err.message || 'An unexpected error occurred',
      // Expose stack trace only in development
      ...(isProduction ? {} : { stack: err.stack }),
    },
  });
}

/**
 * 404 handler — register before errorHandler but after all valid routes.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function notFoundHandler(req, res, next) {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.status = 404;
  next(err);
}

module.exports = { errorHandler, notFoundHandler };
