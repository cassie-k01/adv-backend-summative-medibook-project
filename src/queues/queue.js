'use strict';
const { createRedis } = require('../config/redis');

let client = null;

// One shared connection, created the first time it is needed.
function getClient() {
  if (!client) client = createRedis();
  return client;
}

// Every doctor and every day has its own waitlist, e.g. "waitlist:1:2026-12-07".
function waitlistKey(doctorId, day) {
  return `waitlist:${doctorId}:${day}`;
}

/**
 * Puts a patient at the back of a doctor's waitlist for one day.
 *
 * Steps:
 *  1. Read the people already waiting
 *  2. If this patient is already there, return their current place
 *  3. Otherwise add them at the back and return their new place
 *
 * returns { alreadyQueued: true/false, position: 1, 2, 3... }
 */
async function joinWaitlist({ patientId, doctorId, day, requestedDatetime }) {
  const redis = getClient();
  const key = waitlistKey(doctorId, day);

  const waiting = await redis.lrange(key, 0, -1);
  const existing = waiting.findIndex((raw) => JSON.parse(raw).patientId === patientId);
  if (existing !== -1) return { alreadyQueued: true, position: existing + 1 };

  const entry = { patientId, doctorId, day, requestedDatetime, joinedAt: new Date().toISOString() };
  const length = await redis.rpush(key, JSON.stringify(entry));
  return { alreadyQueued: false, position: length };
}

module.exports = { getClient, waitlistKey, joinWaitlist };