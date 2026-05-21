'use strict';

/**
 * ordersController.js
 * ─────────────────────────────────────────────────────────────────────────────
 * CRUD operations for the /api/orders resource.
 *
 * Each handler:
 *  1. Reads validated input from req.body / req.params
 *  2. Executes a parameterised SQL query via the shared connection pool
 *  3. Returns a consistent JSON response envelope
 *  4. Passes any errors to Express's centralised error handler via next(err)
 *
 * NOTE: No manual pg_notify() calls here.  The PostgreSQL trigger
 * (orders_change_trigger) fires automatically after every INSERT / UPDATE /
 * DELETE, so real-time notifications happen without any application-layer code.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { pool } = require('../config/db');

// ── GET /api/orders ───────────────────────────────────────────────────────────
/**
 * Return all orders, newest first.
 */
async function getAllOrders(req, res, next) {
  try {
    const result = await pool.query(
      'SELECT * FROM orders ORDER BY updated_at DESC'
    );

    res.status(200).json({
      success: true,
      count: result.rowCount,
      data: result.rows,
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/orders/:id ───────────────────────────────────────────────────────
/**
 * Return a single order by primary key.
 */
async function getOrderById(req, res, next) {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);

    if (result.rowCount === 0) {
      const err = new Error(`Order with id=${id} not found`);
      err.status = 404;
      return next(err);
    }

    res.status(200).json({ success: true, data: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/orders ──────────────────────────────────────────────────────────
/**
 * Create a new order.
 * The INSERT triggers orders_change_trigger → pg_notify → Socket.IO broadcast.
 */
async function createOrder(req, res, next) {
  const { customer_name, product_name, status = 'pending' } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO orders (customer_name, product_name, status, updated_at)
       VALUES ($1, $2, $3, NOW())
       RETURNING *`,
      [customer_name, product_name, status]
    );

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/orders/:id ───────────────────────────────────────────────────────
/**
 * Partially or fully update an existing order.
 * Only fields provided in the request body are modified.
 */
async function updateOrder(req, res, next) {
  const { id } = req.params;
  const { customer_name, product_name, status } = req.body;

  // Build a dynamic SET clause from whichever fields were supplied
  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (customer_name !== undefined) {
    fields.push(`customer_name = $${paramIndex++}`);
    values.push(customer_name);
  }
  if (product_name !== undefined) {
    fields.push(`product_name = $${paramIndex++}`);
    values.push(product_name);
  }
  if (status !== undefined) {
    fields.push(`status = $${paramIndex++}`);
    values.push(status);
  }

  if (fields.length === 0) {
    const err = new Error('At least one field must be provided for update');
    err.status = 400;
    return next(err);
  }

  // Always refresh updated_at
  fields.push(`updated_at = NOW()`);
  values.push(id); // last placeholder for WHERE clause

  try {
    const result = await pool.query(
      `UPDATE orders SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rowCount === 0) {
      const err = new Error(`Order with id=${id} not found`);
      err.status = 404;
      return next(err);
    }

    res.status(200).json({
      success: true,
      message: 'Order updated successfully',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/orders/:id ────────────────────────────────────────────────────
/**
 * Permanently remove an order.
 */
async function deleteOrder(req, res, next) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM orders WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rowCount === 0) {
      const err = new Error(`Order with id=${id} not found`);
      err.status = 404;
      return next(err);
    }

    res.status(200).json({
      success: true,
      message: 'Order deleted successfully',
      data: result.rows[0],
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAllOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
};
