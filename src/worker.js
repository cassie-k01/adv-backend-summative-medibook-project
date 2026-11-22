'use strict';
require('dotenv').config();
const { createRedis } = require('./config/redis');
const { KEYS, getClient, waitlistKey } = require('./queues/queue');
const handlers = require('./queues/jobHandlers');

const MAX_ATTEMPTS = 3;

// The worker has two connections: one that waits for new jobs, and one for everything else.
const waiting = createRedis({ maxRetriesPerRequest: null });
const redis = getClient();
let running = true;

/**
 * Runs once when the worker starts.
 *
 * If the last run stopped halfway, unfinished work is still in the "processing" lists.
 *  1. Unfinished jobs go back to the front of the job queue
 *  2. Waitlisted patients being booked go back to the front of their own waitlist
 */
async function recover() {
  let moved;
  do {
    moved = await redis.lmove(KEYS.jobsProcessing, KEYS.jobs, 'RIGHT', 'LEFT');
  } while (moved);

  let raw = await redis.lpop(KEYS.waitlistProcessing);
  while (raw) {
    const entry = JSON.parse(raw);
    await redis.lpush(waitlistKey(entry.doctorId, entry.day), raw);
    raw = await redis.lpop(KEYS.waitlistProcessing);
  }
}

/**
 * Handles a job that failed.
 *
 * Rules:
 *  1. Count the attempt and remember the error
 *  2. Fewer than 3 attempts -> back into the queue to try again
 *  3. 3 attempts used -> into the "dead" list, so it can be inspected
 *  4. Either way, take it out of the processing list (all in one step)
 */
async function retryOrBury(raw, job, reason) {
  const next = { ...job, attempts: (job.attempts || 0) + 1, lastError: reason };
  const target = next.attempts >= MAX_ATTEMPTS ? KEYS.jobsDead : KEYS.jobs;
  await redis.multi().rpush(target, JSON.stringify(next)).lrem(KEYS.jobsProcessing, 1, raw).exec();
  console.error(`Job "${job.type}" failed (attempt ${next.attempts}): ${reason}`);
}

/**
 * Does one job.
 *
 * Steps:
 *  1. Read the note
 *  2. Find the handler for its type
 *  3. Run it, then delete the note from the processing list
 *
 * Unreadable notes and unknown job types go straight to the dead list.
 */
async function processJob(raw) {
  let job;
  try {
    job = JSON.parse(raw);
  } catch (err) {
    await redis.multi().rpush(KEYS.jobsDead, raw).lrem(KEYS.jobsProcessing, 1, raw).exec();
    console.error('Unreadable job moved to the dead list');
    return;
  }

  const handler = handlers[job.type];
  if (!handler) {
    await retryOrBury(raw, { ...job, attempts: MAX_ATTEMPTS - 1 }, `unknown job type "${job.type}"`);
    return;
  }

  try {
    await handler(job.payload);
    await redis.lrem(KEYS.jobsProcessing, 1, raw);
    console.log(`Job "${job.type}" done`);
  } catch (err) {
    await retryOrBury(raw, job, err.message);
  }
}

// The main loop: wait for a job (up to 5 seconds), do it, repeat.
async function main() {
  await recover();
  console.log('Worker started, waiting for jobs...');

  while (running) {
    try {
      const raw = await waiting.blmove(KEYS.jobs, KEYS.jobsProcessing, 'LEFT', 'RIGHT', 5);
      if (raw) await processJob(raw);
    } catch (err) {
      console.error('Worker problem:', err.message);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  waiting.disconnect();
  redis.disconnect();
}

['SIGINT', 'SIGTERM'].forEach((signal) =>
  process.on(signal, () => {
    console.log('Worker stopping after the current job...');
    running = false;
  })
);

main();