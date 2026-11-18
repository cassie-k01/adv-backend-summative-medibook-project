'use strict';
const patientModel = require('../models/patientModel');

async function list(req, res, next) {
  try {
    const patients = await patientModel.findAll();
    res.json(patients);
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'id must be a positive integer' });
    }
    const patient = await patientModel.findById(id);
    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    res.json(patient);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne };