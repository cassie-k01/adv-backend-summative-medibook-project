'use strict';
const express = require('express');
const controller = require('../controllers/doctorController');

const router = express.Router();

router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id', controller.getOne);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.get('/:id/stats', controller.stats);

module.exports = router;