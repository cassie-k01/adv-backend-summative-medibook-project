'use strict';
const appointmentModel = require('../models/appointmentModel');
const { AppError } = require('../lib/errors');
const { validateSlot } = require('../lib/validation');
const { calculateRefund } = require('../lib/refund');
const { toSqlDatetime, parseSqlDatetime } = require('../lib/datetime');
const { audit } = require('../lib/auditLogger');
const { enqueueJob } = require('../queues/queue');

function parseId(raw, name = 'id') {
  const ok = (typeof raw === 'number' || typeof raw === 'string') && /^[1-9]\d{0,9}$/.test(String(raw));
  if (!ok) throw new AppError(400, `${name} must be a positive integer`, 'VALIDATION_ERROR');
  return Number(raw);
}

/**
 * Books one appointment. Used by the API and, later, by the waitlist worker.
 *
 * Steps:
 *  1. Check the requested time, e.g. "2026-12-14T09:30"
 *  2. Ask the model to book it (it enforces the slot and 12 a day rules)
 *  3. Write a line to the audit log
 *  4. Add a "send confirmation" job to the queue
 *
 * The log and the queue never fail the booking. If Redis is down, the
 * booking still succeeds and the problem is written to the audit log.
 *
 * bad time -> HTTP 400 or 422. Slot taken or day full -> HTTP 409.
 */
async function bookAppointment({ patientId, doctorId, apptDatetime, source = 'api' }) {
  const slot = validateSlot(apptDatetime);
  if (!slot.valid) {
    throw new AppError(slot.code === 'MALFORMED' ? 400 : 422, slot.message, slot.code);
  }

  const id = await appointmentModel.book({
    patientId,
    doctorId,
    sqlDatetime: slot.sqlDatetime,
    dayStart: slot.dayStart,
    dayEnd: slot.dayEnd,
  });
  const appt = await appointmentModel.findById(id);

  audit('appointment.booked', {
    appointmentId: appt.id,
    patientId: appt.patient_id,
    doctorId: appt.doctor_id,
    apptDatetime: appt.appt_datetime,
    amountPaid: appt.amount_paid,
    source,
  });

  enqueueJob('notify', {
    appointmentId: appt.id,
    channel: 'email',
    to: appt.patient_email,
    subject: 'Appointment confirmed',
    body: `Hello ${appt.patient_name}, your appointment with ${appt.doctor_name} (room ${appt.doctor_room}) is confirmed for ${appt.appt_datetime}.`,
  }).catch((err) => audit('queue.enqueue_failed', { job: 'notify', appointmentId: appt.id, error: err.message }));

  return appt;
}

async function getOne(req, res, next) {
  try {
    const appt = await appointmentModel.findById(parseId(req.params.id));
    if (!appt) throw new AppError(404, 'Appointment not found', 'APPOINTMENT_NOT_FOUND');
    res.json(appt);
  } catch (err) {
    next(err);
  }
}

/**
 * Handles POST /api/appointments.
 *
 * Steps:
 *  1. Check the two ids
 *  2. Book the appointment
 *  3. If the slot is taken or the day is full, tell the patient how to join the waitlist
 *
 * bad input -> HTTP 400 or 422. Slot taken or day full -> HTTP 409.
 */
async function book(req, res, next) {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const patientId = parseId(body.patient_id, 'patient_id');
    const doctorId = parseId(body.doctor_id, 'doctor_id');

    try {
      const appt = await bookAppointment({ patientId, doctorId, apptDatetime: body.appt_datetime });
      return res.status(201).location(`/api/appointments/${appt.id}`).json(appt);
    } catch (err) {
      if (err instanceof AppError && (err.code === 'SLOT_TAKEN' || err.code === 'DAY_FULL')) {
        throw new AppError(409, err.message, err.code, {
          waitlist_offer: {
            message: 'Join the waitlist and you will be booked automatically when a slot frees up that day.',
            method: 'POST',
            href: '/api/waitlist',
            body: { patient_id: patientId, doctor_id: doctorId, appt_datetime: body.appt_datetime },
          },
        });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Handles POST /api/appointments/:id/cancellation.
 *
 * Steps:
 *  1. Check the id
 *  2. Cancel it and save the refund (one transaction in the model)
 *  3. Write a line to the audit log
 *  4. Add a "slot freed" job, so the worker can book the first person on the waitlist
 *  5. Send back the refund amount
 *
 * not found -> HTTP 404. Already cancelled -> HTTP 409. In the past -> HTTP 422.
 */
async function cancel(req, res, next) {
  try {
    const id = parseId(req.params.id);
    const now = new Date();

    const computeRefund = (appt) => {
      const apptDate = parseSqlDatetime(appt.appt_datetime);
      if (apptDate.getTime() <= now.getTime()) {
        throw new AppError(422, 'This appointment has already started or passed', 'APPOINTMENT_IN_PAST');
      }
      return calculateRefund({ amountPaid: appt.amount_paid, apptDate, now });
    };

    const cancelledAt = toSqlDatetime(now);
    const { appointment, refund } = await appointmentModel.cancel(id, { cancelledAt, computeRefund });

    audit('appointment.cancelled', {
      appointmentId: id,
      patientId: appointment.patient_id,
      doctorId: appointment.doctor_id,
      apptDatetime: appointment.appt_datetime,
      refundPercent: refund.percent,
      refundAmount: refund.refundAmount,
    });

    enqueueJob('slot-freed', {
      doctorId: appointment.doctor_id,
      apptDatetime: appointment.appt_datetime,
    }).catch((err) => audit('queue.enqueue_failed', { job: 'slot-freed', appointmentId: id, error: err.message }));

    res.status(201).json({
      appointment_id: id,
      status: 'cancelled',
      cancelled_at: cancelledAt,
      notice_hours: Math.round(refund.noticeHours * 100) / 100,
      refund: { percent: refund.percent, amount: refund.refundAmount },
      message: `Appointment cancelled. Refund: ${refund.refundAmount.toFixed(2)} (${refund.percent}% of ${appointment.amount_paid.toFixed(2)}).`,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { bookAppointment, getOne, book, cancel };