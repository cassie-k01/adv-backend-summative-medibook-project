'use strict';
const pool = require('../config/db');

async function findAll() {
  const [rows] = await pool.execute(
    'SELECT id, full_name, email, phone, created_at FROM patients ORDER BY id'
  );
  return rows;
}

async function findById(id) {
  const [rows] = await pool.execute(
    'SELECT id, full_name, email, phone, created_at FROM patients WHERE id = ?',
    [id]
  );
  return rows[0] || null;
}

module.exports = { findAll, findById };