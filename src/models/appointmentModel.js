'use strict';
const pool = require('../config/db');
const { AppError } = require('../lib/errors');

const DAILY_CAP = 12;

const SELECT_APPOINTMENT = `
  SELECT a.id, a.patient_id, a.doctor_id, a.appt_datetime, a.status, a.amount_paid,
         a.booked_on, a.cancelled_at, a.refund_amount,
         p.full_name AS patient_name, d.full_name AS doctor_name, d.room AS doctor_room
  FROM appointments a
  JOIN patients p ON p.id = a.patient_id
  JOIN doctors d ON d.id = a.doctor_id`;

async function findById(id) {
  const [rows] = await pool.execute(`${SELECT_APPOINTMENT} WHERE a.id = ?`, [id]);
  return rows[0] || null;
}

/**
 * Book a slot inside one transaction. The doctor row is locked first (FOR UPDATE), so two
 * bookings for the same doctor run one after the other. That makes the 12-per-day count
 * safe. The UNIQUE (doctor_id, active_slot) index is the final safety net for the slot rule.
 * READ COMMITTED means every query sees the latest committed data. Returns the new id.
 */
async function book({ patientId, doctorId, sqlDatetime, dayStart, dayEnd }) {
  const conn = await pool.getConnection();
  try {
    await conn.query('SET TRANSACTION ISOLATION LEVEL READ COMMITTED');
    await conn.beginTransaction();

    const [doctors] = await conn.execute(
      'SELECT id, consultation_fee FROM doctors WHERE id = ? FOR UPDATE',
      [doctorId]
    );
    if (doctors.length === 0) throw new AppError(404, 'Doctor not found', 'DOCTOR_NOT_FOUND');

    const [patients] = await conn.execute('SELECT id FROM patients WHERE id = ?', [patientId]);
    if (patients.length === 0) throw new AppError(404, 'Patient not found', 'PATIENT_NOT_FOUND');

    const [[slot]] = await conn.execute(
      "SELECT COUNT(*) AS taken FROM appointments WHERE doctor_id = ? AND appt_datetime = ? AND status = 'booked'",
      [doctorId, sqlDatetime]
    );
    if (slot.taken > 0) throw new AppError(409, 'That slot is already booked for this doctor', 'SLOT_TAKEN');

    const [[day]] = await conn.execute(
      `SELECT COUNT(*) AS booked FROM appointments
       WHERE doctor_id = ? AND status = 'booked' AND appt_datetime >= ? AND appt_datetime < ?`,
      [doctorId, dayStart, dayEnd]
    );
    if (day.booked >= DAILY_CAP) {
      throw new AppError(409, `This doctor already has ${DAILY_CAP} appointments that day`, 'DAY_FULL');
    }

    const [result] = await conn.execute(
      'INSERT INTO appointments (patient_id, doctor_id, appt_datetime, amount_paid) VALUES (?, ?, ?, ?)',
      [patientId, doctorId, sqlDatetime, doctors[0].consultation_fee]
    );
    await conn.commit();
    return result.insertId;
  } catch (err) {
    await conn.rollback().catch(() => {});
    if (err.code === 'ER_DUP_ENTRY') {
      throw new AppError(409, 'That slot is already booked for this doctor', 'SLOT_TAKEN');
    }
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Cancels an appointment and saves the refund in one go.
 *
 * Both happen in a single transaction, so either everything is saved or
 * nothing is. The appointment is kept (marked 'cancelled', not deleted),
 * and that frees the slot for someone else to book.
 *
 * computeRefund(appt) is passed in by the controller. If it throws,
 * the cancellation is undone.
 */
async function cancel(id, { cancelledAt, computeRefund }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      'SELECT id, doctor_id, patient_id, appt_datetime, status, amount_paid FROM appointments WHERE id = ? FOR UPDATE',
      [id]
    );
    if (rows.length === 0) throw new AppError(404, 'Appointment not found', 'APPOINTMENT_NOT_FOUND');
    const appt = rows[0];
    if (appt.status === 'cancelled') {
      throw new AppError(409, 'This appointment is already cancelled', 'ALREADY_CANCELLED');
    }

    const refund = computeRefund(appt);
    await conn.execute(
      "UPDATE appointments SET status = 'cancelled', cancelled_at = ?, refund_amount = ? WHERE id = ?",
      [cancelledAt, refund.refundAmount, id]
    );
    await conn.commit();
    return { appointment: appt, refund };
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { findById, book, cancel };