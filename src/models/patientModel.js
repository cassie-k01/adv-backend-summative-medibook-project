'use strict';
const pool = require('../config/db');

const COLUMNS = 'id, full_name, email, phone, created_at';

async function findAll() {
  const [rows] = await pool.execute(`SELECT ${COLUMNS} FROM patients ORDER BY id`);
  return rows;
}

async function findById(id) {
  const [rows] = await pool.execute(`SELECT ${COLUMNS} FROM patients WHERE id = ?`, [id]);
  return rows[0] || null;
}

async function create({ fullName, email, phone }) {
  const [result] = await pool.execute(
    'INSERT INTO patients (full_name, email, phone) VALUES (?, ?, ?)',
    [fullName, email, phone]
  );
  return findById(result.insertId);
}

async function update(id, { fullName, email, phone }) {
  await pool.execute(
    'UPDATE patients SET full_name = ?, email = ?, phone = ? WHERE id = ?',
    [fullName, email, phone, id]
  );
  return findById(id); // null if the patient does not exist
}

async function remove(id) {
  const [result] = await pool.execute('DELETE FROM patients WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

module.exports = { findAll, findById, create, update, remove };