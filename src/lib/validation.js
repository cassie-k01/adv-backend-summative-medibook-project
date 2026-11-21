'use strict';
const { toSqlDate, toSqlDatetime } = require('./datetime');

const SLOT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/;
const OPEN_MINUTES = 9 * 60; // 09:00, first slot
const LAST_SLOT_START_MINUTES = 16 * 60 + 30; // 16:30, so the last slot ends at 17:00

function fail(code, message) {
  return { valid: false, code, message };
}

/**
 * Checks a requested appointment time, e.g. "2026-12-14T09:30".
 *
 * Rules, checked in this order:
 *  1. Must look like YYYY-MM-DDTHH:mm and be a real date
 *  2. Must start on the hour or half hour (:00 or :30)
 *  3. Must start between 09:00 and 16:30 (clinic closes at 17:00)
 *  4. Must be in the future
 *
 * wrong format or fake date -> HTTP 400. Any other failure -> HTTP 422.
 */
function validateSlot(input, now = new Date()) {
  if (typeof input !== 'string') {
    return fail('MALFORMED', 'appt_datetime is required, for example "2026-12-14T09:30"');
  }
  const m = SLOT_PATTERN.exec(input.trim());
  if (!m) return fail('MALFORMED', 'appt_datetime must look like "2026-12-14T09:30"');

  const [year, month, day, hour, minute] = m.slice(1).map(Number);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  const isReal =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute;
  if (!isReal) return fail('MALFORMED', 'appt_datetime is not a real date and time');

  if (minute % 30 !== 0) return fail('NOT_ON_SLOT_BOUNDARY', 'Appointments start at :00 or :30');

  const minutesOfDay = hour * 60 + minute;
  if (minutesOfDay < OPEN_MINUTES || minutesOfDay > LAST_SLOT_START_MINUTES) {
    return fail('OUTSIDE_WORKING_HOURS', 'Appointments run 09:00 to 17:00, so the last slot starts at 16:30');
  }
  if (date.getTime() <= now.getTime()) {
    return fail('IN_THE_PAST', 'Appointments can only be booked in the future');
  }

  const nextDay = new Date(year, month - 1, day + 1);
  return {
    valid: true,
    date,
    sqlDatetime: toSqlDatetime(date),
    dayStart: `${toSqlDate(date)} 00:00:00`,
    dayEnd: `${toSqlDate(nextDay)} 00:00:00`,
  };
}

module.exports = { validateSlot };