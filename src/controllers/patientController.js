'use strict';
const patientModel = require('../models/patientModel');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^[0-9+()\-\s]{7,20}$/;

function parseId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id >= 1 ? id : null;
}

// Returns { errors: [...], value: {...} }. errors is empty when the input is valid.
function validatePatient(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = [];

  if (typeof b.full_name !== 'string' || b.full_name.trim().length < 1 || b.full_name.trim().length > 100) {
    errors.push('full_name is required (1 to 100 characters)');
  }
  if (typeof b.email !== 'string' || b.email.length > 255 || !EMAIL.test(b.email.trim())) {
    errors.push('email must be a valid email address');
  }
  if (typeof b.phone !== 'string' || !PHONE.test(b.phone.trim())) {
    errors.push('phone must be 7 to 20 characters: digits, spaces, +, - and parentheses');
  }

  if (errors.length > 0) return { errors, value: null };
  return {
    errors,
    value: {
      fullName: b.full_name.trim(),
      email: b.email.trim().toLowerCase(),
      phone: b.phone.trim(),
    },
  };
}

async function list(req, res, next) {
  try {
    res.json(await patientModel.findAll());
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'id must be a positive integer' });

    const patient = await patientModel.findById(id);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    res.json(patient);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { errors, value } = validatePatient(req.body);
    if (errors.length > 0) return res.status(400).json({ error: 'Validation failed', details: errors });

    const patient = await patientModel.create(value);
    res.status(201).location(`/api/patients/${patient.id}`).json(patient);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A patient with this email already exists' });
    }
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'id must be a positive integer' });

    const { errors, value } = validatePatient(req.body);
    if (errors.length > 0) return res.status(400).json({ error: 'Validation failed', details: errors });

    const patient = await patientModel.update(id, value);
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    res.json(patient);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'A patient with this email already exists' });
    }
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'id must be a positive integer' });

    const removed = await patientModel.remove(id);
    if (!removed) return res.status(404).json({ error: 'Patient not found' });
    res.status(204).end();
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ error: 'This patient still has appointments and cannot be deleted' });
    }
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove };