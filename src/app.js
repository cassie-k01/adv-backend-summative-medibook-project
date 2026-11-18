'use strict';
const express = require('express');
const patientRoutes = require('./routes/patientRoutes');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api/patients', patientRoutes);

module.exports = app;