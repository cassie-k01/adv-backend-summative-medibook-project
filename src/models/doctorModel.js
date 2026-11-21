'use strict';
const pool = require('../config/db');

const DAILY_CAP = 12;
const COLUMNS = 'id, full_name, specialty, consultation_fee, room, created_at';

async function findAll() {
  const [rows] = await pool.execute(`SELECT ${COLUMNS} FROM doctors ORDER BY id`);
  return rows;
}

async function findById(id) {
  const [rows] = await pool.execute(`SELECT ${COLUMNS} FROM doctors WHERE id = ?`, [id]);
  return rows[0] || null;
}

async function create({ fullName, specialty, consultationFee, room }) {
  const [result] = await pool.execute(
    'INSERT INTO doctors (full_name, specialty, consultation_fee, room) VALUES (?, ?, ?, ?)',
    [fullName, specialty, consultationFee, room]
  );
  return findById(result.insertId);
}

async function update(id, { fullName, specialty, consultationFee, room }) {
  await pool.execute(
    'UPDATE doctors SET full_name = ?, specialty = ?, consultation_fee = ?, room = ? WHERE id = ?',
    [fullName, specialty, consultationFee, room, id]
  );
  return findById(id); // null if the doctor does not exist
}

async function remove(id) {
  const [result] = await pool.execute('DELETE FROM doctors WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

/**
 * Gets the statistics for one doctor.
 *
 * What it returns:
 *  1. revenue_collected: money paid minus any refunds
 *  2. upcoming_appointments: booked appointments that start after now
 *  3. the next 7 days (today plus 6): how many appointments on each day,
 *     including days with none
 *  4. utilization: booked appointments as a percentage of 12 a day
 *
 * If a doctor is not found -> returns null.
 */
async function getStats(id) {
  const summarySql = `
    SELECT d.id, d.full_name, d.specialty, d.room,
           COALESCE(SUM(a.amount_paid - COALESCE(a.refund_amount, 0)), 0) AS revenue_collected,
           COUNT(CASE WHEN a.status = 'booked' AND a.appt_datetime > NOW() THEN 1 END) AS upcoming_appointments,
           ROUND(100 * COUNT(CASE WHEN a.status = 'booked'
                                   AND a.appt_datetime >= CURDATE()
                                   AND a.appt_datetime < CURDATE() + INTERVAL 7 DAY THEN 1 END) / (7 * ?), 1)
             AS utilization_next_7_days_pct
    FROM doctors d
    LEFT JOIN appointments a ON a.doctor_id = d.id
    WHERE d.id = ?
    GROUP BY d.id, d.full_name, d.specialty, d.room`;

  const perDaySql = `
    WITH RECURSIVE days (day_date, n) AS (
      SELECT CURDATE(), 0
      UNION ALL
      SELECT day_date + INTERVAL 1 DAY, n + 1 FROM days WHERE n < 6
    )
    SELECT DATE_FORMAT(days.day_date, '%Y-%m-%d') AS date,
           COUNT(a.id) AS appointments,
           ROUND(100 * COUNT(a.id) / ?, 1) AS utilization_pct
    FROM days
    LEFT JOIN appointments a
           ON a.doctor_id = ?
          AND a.status = 'booked'
          AND a.appt_datetime >= days.day_date
          AND a.appt_datetime < days.day_date + INTERVAL 1 DAY
    GROUP BY days.day_date
    ORDER BY days.day_date`;

  const [[summaryRows], [dayRows]] = await Promise.all([
    pool.execute(summarySql, [DAILY_CAP, id]),
    pool.execute(perDaySql, [DAILY_CAP, id]),
  ]);
  if (summaryRows.length === 0) return null;
  return { summary: summaryRows[0], days: dayRows };
}

module.exports = { findAll, findById, create, update, remove, getStats };