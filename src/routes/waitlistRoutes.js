'use strict';
const express = require('express');
const controller = require('../controllers/waitlistController');

const router = express.Router();

router.post('/', controller.join);

module.exports = router;