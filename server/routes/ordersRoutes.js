'use strict';

/**
 * ordersRoutes.js
 * Maps HTTP verbs + paths to validation chains and controller handlers.
 *
 * Route table:
 *   GET    /api/orders        → getAllOrders
 *   GET    /api/orders/:id    → getOrderById
 *   POST   /api/orders        → createOrder
 *   PUT    /api/orders/:id    → updateOrder
 *   DELETE /api/orders/:id    → deleteOrder
 */

const { Router } = require('express');
const controller = require('../controllers/ordersController');
const {
  validateId,
  validateCreateOrder,
  validateUpdateOrder,
  handleValidation,
} = require('../middleware/validate');

const router = Router();

// ── Collection routes ─────────────────────────────────────────────────────────
router
  .route('/')
  .get(controller.getAllOrders)
  .post(validateCreateOrder, handleValidation, controller.createOrder);

// ── Individual resource routes ────────────────────────────────────────────────
router
  .route('/:id')
  .get(validateId, handleValidation, controller.getOrderById)
  .put(validateUpdateOrder, handleValidation, controller.updateOrder)
  .delete(validateId, handleValidation, controller.deleteOrder);

module.exports = router;
