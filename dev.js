// Local development server: API + website together at http://localhost:5000
require('dotenv').config();
const express = require('express');
const path = require('path');
const app = require('./lib/app');

const server = express();
server.use(app);
server.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Local dev API running at http://localhost:${PORT}/api`);
  console.log(`Open the website:       http://localhost:${PORT}`);
});
