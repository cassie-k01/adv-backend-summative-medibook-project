'use strict';
const appointmentModel = require('../models/appointmentModel');
const { AppError } = require('../lib/errors');
const { validateSlot } = require('../lib/validation');
const { calculateRefund } = require('../lib/refund');
const { toSqlDatetime, parseSqlDatetime } = require('../lib/datetime');
const { audit } = require('../lib/auditLogger');

function parseId(raw, name = 'id') {
  const ok = (typeof raw === 'number' || typeof raw === 'string') && /^[1-9]\d{0,9}$/.test(String(raw));
  if (!ok) throw new AppError(400, `${name} must be a positive integer`, 'VALIDATION_ERROR');
  return Number(raw);
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
 * Books an appointment.
 *
 * Steps:
 *  1. Check the ids and the requested time
 *  2. Ask the model to book it (the model enforces the slot and the 12 a day rules)
 *  3. Write a line to the audit log
 *  4. Send back the new appointment
 *
 * bad input -> HTTP 400 or 422. Slot taken or day full -> HTTP 409.
 */
async function book(req, res, next) {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const patientId = parseId(body.patient_id, 'patient_id');
    const doctorId = parseId(body.doctor_id, 'doctor_id');

    const slot = validateSlot(body.appt_datetime);
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

    // Not awaited on purpose: logging must never slow down or fail the booking
    audit('appointment.booked', {
      appointmentId: appt.id,
      patientId: appt.patient_id,
      doctorId: appt.doctor_id,
      apptDatetime: appt.appt_datetime,
      amountPaid: appt.amount_paid,
    });

    res.status(201).location(`/api/appointments/${id}`).json(appt);
  } catch (err) {
    next(err);
  }
}

/**
 * Cancels an appointment and works out the refund.
 *
 * Steps:
 *  1. Check the id
 *  2. Ask the model to cancel it (it saves the status and the refund together)
 *  3. Write a line to the audit log
 *  4. Send back the refund amount
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

module.exports = { getOne, book, cancel };