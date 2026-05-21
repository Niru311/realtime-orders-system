'use strict';

/**
 * validate.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Reusable validation chains built with express-validator.
 *
 * Pattern:
 *   router.post('/', validateCreateOrder, handleValidation, controller.create);
 *
 * handleValidation collects all errors produced by the chains and responds
 * with 422 if any exist, keeping controllers clean of validation logic.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { body, param, validationResult } = require('express-validator');

const VALID_STATUSES = ['pending', 'shipped', 'delivered'];

// ── Validation chains ─────────────────────────────────────────────────────────

/** Validate the :id route parameter */
const validateId = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('Order ID must be a positive integer'),
];

/** Validate POST /api/orders body */
const validateCreateOrder = [
  body('customer_name')
    .trim()
    .notEmpty()
    .withMessage('customer_name is required')
    .isLength({ max: 255 })
    .withMessage('customer_name must be ≤ 255 characters'),

  body('product_name')
    .trim()
    .notEmpty()
    .withMessage('product_name is required')
    .isLength({ max: 255 })
    .withMessage('product_name must be ≤ 255 characters'),

  body('status')
    .optional()
    .isIn(VALID_STATUSES)
    .withMessage(`status must be one of: ${VALID_STATUSES.join(', ')}`),
];

/** Validate PUT /api/orders/:id body */
const validateUpdateOrder = [
  ...validateId,

  body('customer_name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('customer_name cannot be blank')
    .isLength({ max: 255 })
    .withMessage('customer_name must be ≤ 255 characters'),

  body('product_name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('product_name cannot be blank')
    .isLength({ max: 255 })
    .withMessage('product_name must be ≤ 255 characters'),

  body('status')
    .optional()
    .isIn(VALID_STATUSES)
    .withMessage(`status must be one of: ${VALID_STATUSES.join(', ')}`),
];

// ── Result collector ──────────────────────────────────────────────────────────

/**
 * Middleware that reads the accumulated validation errors and responds
 * with 422 Unprocessable Entity if there are any.
 * Must come AFTER the validation chains in the route definition.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      error: {
        message: 'Validation failed',
        details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
      },
    });
  }
  next();
}

module.exports = {
  validateId,
  validateCreateOrder,
  validateUpdateOrder,
  handleValidation,
};
