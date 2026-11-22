'use strict';
const { writeAudit } = require('../lib/auditLogger');

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
 * A slot was freed by a cancellation.
 *
 * For now this only records that the note arrived.
 * Step 7 replaces it with the real waitlist promotion.
 */
async function handleSlotFreed(payload) {
  await writeAudit('slot.freed_received', {
    doctorId: payload.doctorId,
    apptDatetime: payload.apptDatetime,
  });
}

module.exports = { notify: handleNotify, 'slot-freed': handleSlotFreed };