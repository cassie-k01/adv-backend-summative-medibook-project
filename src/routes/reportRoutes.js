'use strict';
const express = require('express');
const controller = require('../controllers/reportController');

const router = express.Router();

router.get('/doctors', controller.doctors);
router.get('/busy-days', controller.busyDays);

module.exports = router;