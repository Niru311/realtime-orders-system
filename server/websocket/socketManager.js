'use strict';

/**
 * socketManager.js
 * Initialises the Socket.IO server and wires up connection lifecycle events.
 *
 * Design decisions:
 *  - The io instance is stored as a module-level singleton so that the
 *    pg listener (running in a different module) can import and use it
 *    to emit events without circular dependency issues.
 *  - All clients automatically join the "orders" room on connection so
 *    broadcasts are targeted rather than shotgun-fired at every socket.
 */

const { Server } = require('socket.io');
const env = require('../config/env');

/** @type {import('socket.io').Server | null} */
let io = null;

/**
 * Initialise Socket.IO on an existing HTTP server.
 *
 * @param {import('http').Server} httpServer
 * @returns {import('socket.io').Server}
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST'],
    },
    pingTimeout: env.SOCKET_PING_TIMEOUT,
    pingInterval: env.SOCKET_PING_INTERVAL,
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected    → id=${socket.id}`);

    // Every client joins the shared "orders" room
    socket.join('orders');

    // Acknowledge the client so it knows it is fully ready
    socket.emit('connected', {
      message: 'Connected to real-time orders stream',
      socketId: socket.id,
      timestamp: new Date().toISOString(),
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Client disconnected ← id=${socket.id} reason=${reason}`);
    });

    socket.on('error', (err) => {
      console.error(`[Socket.IO] Socket error id=${socket.id}:`, err.message);
    });
  });

  console.log('[Socket.IO] Server initialised');
  return io;
}

/**
 * Return the singleton io instance.
 * Throws if initSocket() has not been called yet.
 *
 * @returns {import('socket.io').Server}
 */
function getIO() {
  if (!io) {
    throw new Error('Socket.IO has not been initialised. Call initSocket() first.');
  }
  return io;
}

/**
 * Broadcast a payload to all clients in the "orders" room.
 *
 * @param {string} event   - Socket.IO event name
 * @param {object} payload - Data to send
 */
function broadcast(event, payload) {
  getIO().to('orders').emit(event, payload);
}

module.exports = { initSocket, getIO, broadcast };
