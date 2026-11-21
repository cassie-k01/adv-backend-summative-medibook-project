'use strict';
const reportModel = require('../models/reportModel');

// Sends every doctor with their appointment totals and revenue.
async function doctors(req, res, next) {
  try {
    res.json({ data: await reportModel.doctorsReport() });
  } catch (err) {
    next(err);
  }
}

// Sends every doctor-day that is more than 80% booked.
async function busyDays(req, res, next) {
  try {
    res.json({ data: await reportModel.busyDays() });
  } catch (err) {
    next(err);
  }
}

module.exports = { doctors, busyDays };