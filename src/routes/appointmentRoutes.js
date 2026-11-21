'use strict';
const express = require('express');
const controller = require('../controllers/appointmentController');

const router = express.Router();

router.post('/', controller.book);
router.get('/:id', controller.getOne);
// A cancellation is a sub-resource of the appointment. Creating it returns 201 with the refund.
router.post('/:id/cancellation', controller.cancel);

module.exports = router;