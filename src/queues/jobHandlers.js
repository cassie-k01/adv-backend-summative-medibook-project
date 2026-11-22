'use strict';
const { writeAudit, audit } = require('../lib/auditLogger');
const { AppError } = require('../lib/errors');
const { KEYS, getClient, waitlistKey } = require('./queue');
const { bookAppointment } = require('../controllers/appointmentController');

/**
 * Sends a confirmation message. We don't send anything real, we just
 * write the message to the audit log, as the brief says.
 */
async function handleNotify(payload) {
  await writeAudit('notification.sent', {
    appointmentId: payload.appointmentId,
    channel: payload.channel,
    to: payload.to,
    subject: payload.subject,
    body: payload.body,
  });
}

/**
 * Puts a patient back at the FRONT of their waitlist, so they keep their place.
 * Both steps happen together, so the patient is never in zero lists.
 */
async function putBack(key, raw) {
  await getClient().multi().lpush(key, raw).lrem(KEYS.waitlistProcessing, 1, raw).exec();
}

/**
 * Moves a patient who can't be booked into the "dead" list, with the reason.
 * Both steps happen together, so the patient is never in zero lists.
 */
async function moveToDead(raw, entry, reason) {
  const dead = JSON.stringify({ ...entry, reason, failedAt: new Date().toISOString() });
  await getClient().multi().rpush(KEYS.waitlistDead, dead).lrem(KEYS.waitlistProcessing, 1, raw).exec();
}

/**
 * A cancellation freed a slot. Books the first waitlisted patient into it.
 *
 * Steps:
 *  1. Move the first patient from the doctor's waitlist for that day into the "processing" list
 *  2. Try to book them into the freed slot (same rules as any other booking)
 *  3. Booked -> remove them from "processing"
 *  4. Slot or day taken in the meantime -> back to the front of the waitlist
 *  5. Patient no longer exists -> "dead" list plus audit log, then try the next patient
 *  6. Unexpected error -> back to the front of the waitlist, and the job is retried
 */
async function handleSlotFreed({ doctorId, apptDatetime }) {
  const redis = getClient();
  const key = waitlistKey(doctorId, apptDatetime.slice(0, 10));

  const raw = await redis.lmove(key, KEYS.waitlistProcessing, 'LEFT', 'RIGHT');
  if (!raw) return; // nobody is waiting

  const entry = JSON.parse(raw);

  try {
    await bookAppointment({
      patientId: entry.patientId,
      doctorId,
      apptDatetime: apptDatetime.slice(0, 16),
      source: 'waitlist',
    });
    await redis.lrem(KEYS.waitlistProcessing, 1, raw);
    audit('waitlist.promoted', { patientId: entry.patientId, doctorId, apptDatetime });
  } catch (err) {
    if (err instanceof AppError && err.code === 'PATIENT_NOT_FOUND') {
      await moveToDead(raw, entry, err.code);
      audit('waitlist.promotion_failed', { patientId: entry.patientId, doctorId, reason: err.code });
      return handleSlotFreed({ doctorId, apptDatetime }); // the slot is still free, try the next patient
    }

    if (err instanceof AppError) {
      // The slot or day is not available (any more). Keep the patient's place.
      await putBack(key, raw);
      audit('waitlist.promotion_deferred', { patientId: entry.patientId, doctorId, reason: err.code });
      return;
    }

    await putBack(key, raw);
    throw err; // unexpected, so the worker retries the whole job
  }
}

module.exports = { notify: handleNotify, 'slot-freed': handleSlotFreed };