'use strict';
require('dotenv').config();
const Redis = require('ioredis');

/**
 * Creates a connection to Redis.
 *
 * Rules:
 *  1. Host and port come from .env, with local defaults
 *  2. A failed command gives up after one retry, so the API answers quickly when Redis is down
 *  3. Connection errors are printed once instead of crashing the app
 *  4. Extra options can be passed in (the worker uses this for its waiting connection)
 */
function createRedis(options = {}) {
  const client = new Redis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: Number(process.env.REDIS_PORT || 6379),
    maxRetriesPerRequest: 1,
    retryStrategy: (times) => Math.min(times * 200, 2000),
    ...options,
  });

  let warned = false;
  client.on('error', (err) => {
    if (!warned) {
      console.error('Redis connection problem:', err.message);
      warned = true;
    }
  });
  client.on('ready', () => {
    warned = false;
  });

  return client;
}

module.exports = { createRedis };