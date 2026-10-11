const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/master'));
app.use('/api/papers', require('./routes/papers'));
app.use('/api', require('./routes/process'));
app.use('/api/reports', require('./routes/reports'));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, req, res, next) => {   // last-resort error handler
  console.error(err);
  res.status(500).json({ error: 'Server error: ' + err.message });
});

module.exports = app;
