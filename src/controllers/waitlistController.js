'use strict';
const availabilityModel = require('../models/availabilityModel');
const { AppError } = require('../lib/errors');
const { validateSlot } = require('../lib/validation');
const { joinWaitlist } = require('../queues/queue');
const { audit } = require('../lib/auditLogger');

function parseId(raw, name) {
  const ok = (typeof raw === 'number' || typeof raw === 'string') && /^[1-9]\d{0,9}$/.test(String(raw));
  if (!ok) throw new AppError(400, `${name} must be a positive integer`, 'VALIDATION_ERROR');
  return Number(raw);
}

/**
 * Adds a patient to a doctor's waitlist for one day.
 *
 * Steps:
 *  1. Check the ids and the requested time (same rules as booking)
 *  2. Check the slot or the day is really full, otherwise tell them to book directly
 *  3. Put the patient at the back of the Redis line
 *
 * The patient agrees to take the first slot that frees up with this doctor on that day.
 *
 * bad input -> HTTP 400 or 422. Unknown patient or doctor -> HTTP 404.
 * Slot still free -> HTTP 409. Redis down -> HTTP 503.
 */
async function join(req, res, next) {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const patientId = parseId(body.patient_id, 'patient_id');
    const doctorId = parseId(body.doctor_id, 'doctor_id');

    const slot = validateSlot(body.appt_datetime);
    if (!slot.valid) {
      throw new AppError(slot.code === 'MALFORMED' ? 400 : 422, slot.message, slot.code);
    }

    const reason = await availabilityModel.checkAvailability({
      patientId,
      doctorId,
      sqlDatetime: slot.sqlDatetime,
      dayStart: slot.dayStart,
      dayEnd: slot.dayEnd,
    });
    if (!reason) {
      throw new AppError(
        409,
        'That slot is still free, book it directly with POST /api/appointments',
        'SLOT_AVAILABLE'
      );
    }

    const day = slot.dayStart.slice(0, 10);

    let result;
    try {
      result = await joinWaitlist({
        patientId,
        doctorId,
        day,
        requestedDatetime: slot.sqlDatetime,
      });
    } catch (err) {
      throw new AppError(503, 'The waitlist is unavailable right now, please try again soon', 'QUEUE_UNAVAILABLE');
    }

    audit('waitlist.joined', { patientId, doctorId, day, position: result.position });

    res.status(result.alreadyQueued ? 200 : 201).json({
      status: result.alreadyQueued ? 'already_waitlisted' : 'waitlisted',
      position: result.position,
      doctor_id: doctorId,
      day,
      message: 'You will be booked automatically into the first slot that frees up with this doctor that day.',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { join };