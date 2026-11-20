'use strict';
const doctorModel = require('../models/doctorModel');

function parseId(raw) {
  const id = Number(raw);
  return Number.isInteger(id) && id >= 1 ? id : null;
}

function validateDoctor(body) {
  const b = body && typeof body === 'object' ? body : {};
  const errors = [];
  const isText = (v, max) => typeof v === 'string' && v.trim().length >= 1 && v.trim().length <= max;

  if (!isText(b.full_name, 100)) errors.push('full_name is required (1 to 100 characters)');
  if (!isText(b.specialty, 80)) errors.push('specialty is required (1 to 80 characters)');
  if (!isText(b.room, 10)) errors.push('room is required (1 to 10 characters)');

  const fee = b.consultation_fee;
  const feeOk =
    typeof fee === 'number' &&
    Number.isFinite(fee) &&
    fee >= 0 &&
    fee <= 99999999.99 &&
    Math.abs(fee * 100 - Math.round(fee * 100)) < 1e-6;
  if (!feeOk) errors.push('consultation_fee must be a number >= 0 with at most 2 decimal places');

  if (errors.length > 0) return { errors, value: null };
  return {
    errors,
    value: {
      fullName: b.full_name.trim(),
      specialty: b.specialty.trim(),
      consultationFee: Math.round(fee * 100) / 100,
      room: b.room.trim(),
    },
  };
}

async function list(req, res, next) {
  try {
    res.json(await doctorModel.findAll());
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'id must be a positive integer' });

    const doctor = await doctorModel.findById(id);
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
    res.json(doctor);
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { errors, value } = validateDoctor(req.body);
    if (errors.length > 0) return res.status(400).json({ error: 'Validation failed', details: errors });

    const doctor = await doctorModel.create(value);
    res.status(201).location(`/api/doctors/${doctor.id}`).json(doctor);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'id must be a positive integer' });

    const { errors, value } = validateDoctor(req.body);
    if (errors.length > 0) return res.status(400).json({ error: 'Validation failed', details: errors });

    const doctor = await doctorModel.update(id, value);
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
    res.json(doctor);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'id must be a positive integer' });

    const removed = await doctorModel.remove(id);
    if (!removed) return res.status(404).json({ error: 'Doctor not found' });
    res.status(204).end();
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ error: 'This doctor still has appointments and cannot be deleted' });
    }
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove };