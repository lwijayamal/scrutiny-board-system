const { Pool, types } = require('pg');
require('dotenv').config();

// Return DATE columns as plain 'YYYY-MM-DD' text (avoids timezone shifts)
types.setTypeParser(1082, (v) => v);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 3
});

module.exports = pool;
