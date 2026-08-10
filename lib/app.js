require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const boardRoutes = require('./routes/boards');
const caseRoutes = require('./routes/cases');

const app = express();

// Same-origin on Vercel means CORS usually isn't even hit, but this stays
// permissive-but-explicit in case you ever call the API from another origin
// (e.g. testing the frontend locally against the deployed API).
app.use(cors());
app.use(express.json());

app.get('/api', (req, res) => {
  res.json({ status: 'ok', message: 'Scrutiny Board Management System API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/cases', caseRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Route not found' }));

module.exports = app;
