'use strict';
const pool = require('../config/db');

const DAILY_CAP = 12;
const BUSY_THRESHOLD = 0.8;

/**
 * Lists every doctor with their appointment totals and revenue.
 *
 * What each row contains:
 *  1. total_appointments: every booking ever made (active + cancelled)
 *  2. active_appointments and cancelled_appointments: the split of that total
 *  3. revenue_collected: money paid minus refunds
 *
 * Doctors with no appointments are included, with zeros (that is why we LEFT JOIN).
 */
async function doctorsReport() {
  const [rows] = await pool.execute(`
    SELECT d.id AS doctor_id,
           d.full_name AS doctor_name,
           d.specialty,
           COUNT(a.id) AS total_appointments,
           COUNT(CASE WHEN a.status = 'booked' THEN 1 END) AS active_appointments,
           COUNT(CASE WHEN a.status = 'cancelled' THEN 1 END) AS cancelled_appointments,
           COALESCE(SUM(a.amount_paid - COALESCE(a.refund_amount, 0)), 0) AS revenue_collected
    FROM doctors d
    LEFT JOIN appointments a ON a.doctor_id = d.id
    GROUP BY d.id, d.full_name, d.specialty
    ORDER BY revenue_collected DESC, d.full_name`);
  return rows;
}

/**
 * Finds every doctor-day that is more than 80% booked.
 *
 * How it works:
 *  1. Take only booked appointments (cancelled ones free the slot)
 *  2. Group them by doctor and by date
 *  3. Keep the groups where booked / 12 is above 0.8 (so 10 or more)
 */
async function busyDays() {
  const [rows] = await pool.execute(
    `SELECT a.doctor_id,
            d.full_name AS doctor_name,
            DATE_FORMAT(a.appt_datetime, '%Y-%m-%d') AS date,
            COUNT(*) AS booked,
            ROUND(100 * COUNT(*) / ?, 1) AS utilization_pct
     FROM appointments a
     JOIN doctors d ON d.id = a.doctor_id
     WHERE a.status = 'booked'
     GROUP BY a.doctor_id, d.full_name, DATE_FORMAT(a.appt_datetime, '%Y-%m-%d')
     HAVING COUNT(*) / ? > ?
     ORDER BY date, d.full_name`,
    [DAILY_CAP, DAILY_CAP, BUSY_THRESHOLD]
  );
  return rows;
}

module.exports = { doctorsReport, busyDays };