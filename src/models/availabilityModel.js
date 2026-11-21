'use strict';
const pool = require('../config/db');
const { AppError } = require('../lib/errors');

const DAILY_CAP = 12;

/**
 * Finds out why a slot can't be booked right now.
 *
 * Steps, in this order:
 *  1. The doctor must exist, and so must the patient (otherwise 404)
 *  2. Is this exact slot already booked?
 *  3. Does the doctor already have 12 appointments that day?
 *
 * returns 'SLOT_TAKEN', 'DAY_FULL', or null when the slot is free.
 */
async function checkAvailability({ patientId, doctorId, sqlDatetime, dayStart, dayEnd }) {
  const [doctors] = await pool.execute('SELECT id FROM doctors WHERE id = ?', [doctorId]);
  if (doctors.length === 0) throw new AppError(404, 'Doctor not found', 'DOCTOR_NOT_FOUND');

  const [patients] = await pool.execute('SELECT id FROM patients WHERE id = ?', [patientId]);
  if (patients.length === 0) throw new AppError(404, 'Patient not found', 'PATIENT_NOT_FOUND');

  const [[slot]] = await pool.execute(
    "SELECT COUNT(*) AS taken FROM appointments WHERE doctor_id = ? AND appt_datetime = ? AND status = 'booked'",
    [doctorId, sqlDatetime]
  );
  if (slot.taken > 0) return 'SLOT_TAKEN';

  const [[day]] = await pool.execute(
    `SELECT COUNT(*) AS booked FROM appointments
     WHERE doctor_id = ? AND status = 'booked' AND appt_datetime >= ? AND appt_datetime < ?`,
    [doctorId, dayStart, dayEnd]
  );
  if (day.booked >= DAILY_CAP) return 'DAY_FULL';

  return null;
}

module.exports = { checkAvailability };