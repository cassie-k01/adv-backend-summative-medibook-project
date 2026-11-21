'use strict';

const HOUR_MS = 60 * 60 * 1000;

/**
 * How much of the payment to refund, based on how far ahead the
 * cancellation is made:
 *
 *   more than 48 hours before  -> 100% back
 *   24 to 48 hours before      -> 50% back  (exactly 24h or 48h counts here)
 *   less than 24 hours before  -> nothing back
 */
function refundPercent(noticeHours) {
  if (noticeHours > 48) return 100;
  if (noticeHours >= 24) return 50;
  return 0;
}

function calculateRefund({ amountPaid, apptDate, now = new Date() }) {
  if (typeof amountPaid !== 'number' || !Number.isFinite(amountPaid) || amountPaid < 0) {
    throw new TypeError('amountPaid must be a non-negative number');
  }
  if (!(apptDate instanceof Date) || Number.isNaN(apptDate.getTime())) {
    throw new TypeError('apptDate must be a valid Date');
  }
  const noticeHours = (apptDate.getTime() - now.getTime()) / HOUR_MS;
  const percent = refundPercent(noticeHours);
  const cents = Math.round((Math.round(amountPaid * 100) * percent) / 100);
  return { percent, noticeHours, refundAmount: cents / 100 };
}

module.exports = { calculateRefund, refundPercent };