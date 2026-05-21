'use strict';

/**
 * pgListener.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Opens a dedicated PostgreSQL client and issues:
 *
 *   LISTEN orders_channel;
 *
 * When the database fires the orders_change_trigger, PostgreSQL calls
 * pg_notify('orders_channel', <json_payload>).  The pg driver surfaces this
 * as a 'notification' event on the client.  We parse the JSON and forward
 * the data to all connected Socket.IO clients via socketManager.broadcast().
 *
 * WHY a dedicated client (not a pool member)?
 *   A pg.Pool recycles connections between queries. If a pooled connection
 *   receives a LISTEN command and is then returned to the pool, subsequent
 *   callers might get that connection in a "listening" state — causing missed
 *   or duplicated notifications. A separate pg.Client kept alive for the
 *   process lifetime avoids this entirely.
 *
 * WHY no polling / setInterval?
 *   Polling wastes CPU and DB connections, adds latency proportional to the
 *   poll interval, and does not scale.  PostgreSQL LISTEN/NOTIFY is push-based:
 *   the server delivers the notification in microseconds with zero extra load.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { createListenerClient } = require('../config/db');
const { broadcast } = require('../websocket/socketManager');

const CHANNEL = 'orders_channel';
const RECONNECT_DELAY_MS = 5_000; // wait before attempting reconnect

/** @type {import('pg').Client | null} */
let listenerClient = null;

/**
 * Attach notification handler and error/end handlers to a connected client.
 *
 * @param {import('pg').Client} client
 */
function attachHandlers(client) {
  // ── Notification handler ──────────────────────────────────────────────────
  client.on('notification', (msg) => {
    if (msg.channel !== CHANNEL) return;

    let payload;
    try {
      payload = JSON.parse(msg.payload);
    } catch (err) {
      console.error('[PG Listener] Failed to parse notification payload:', err.message);
      return;
    }

    console.log(
      `[PG Listener] Received notification → op=${payload.operation} id=${payload.data?.id}`
    );

    // Forward to all Socket.IO clients in the "orders" room
    broadcast('orderUpdated', payload);
  });

  // ── Error / unexpected disconnect ─────────────────────────────────────────
  client.on('error', (err) => {
    console.error('[PG Listener] Client error:', err.message);
    scheduleReconnect();
  });

  client.on('end', () => {
    console.warn('[PG Listener] Client connection ended unexpectedly');
    scheduleReconnect();
  });
}

/**
 * Schedule a reconnection attempt after RECONNECT_DELAY_MS milliseconds.
 */
function scheduleReconnect() {
  if (listenerClient) {
    listenerClient.removeAllListeners();
    listenerClient = null;
  }
  console.log(`[PG Listener] Reconnecting in ${RECONNECT_DELAY_MS / 1000}s…`);
  setTimeout(startListening, RECONNECT_DELAY_MS);
}

/**
 * Connect a fresh client, issue LISTEN, and attach event handlers.
 * Called once at startup and automatically on reconnect.
 */
async function startListening() {
  try {
    listenerClient = await createListenerClient();
    attachHandlers(listenerClient);
    await listenerClient.query(`LISTEN ${CHANNEL}`);
    console.log(`[PG Listener] Listening on channel "${CHANNEL}"`);
  } catch (err) {
    console.error('[PG Listener] Failed to start:', err.message);
    scheduleReconnect();
  }
}

/**
 * Gracefully disconnect the listener client.
 * Call this during process shutdown.
 */
async function stopListening() {
  if (!listenerClient) return;
  try {
    await listenerClient.query(`UNLISTEN ${CHANNEL}`);
    await listenerClient.end();
    console.log('[PG Listener] Disconnected cleanly');
  } catch (err) {
    console.error('[PG Listener] Error during shutdown:', err.message);
  } finally {
    listenerClient = null;
  }
}

module.exports = { startListening, stopListening };
