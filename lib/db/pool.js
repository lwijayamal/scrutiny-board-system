const { Pool } = require('pg');

// In serverless environments (Vercel), this module can be re-imported across
// invocations within the same warm container. Using a single module-level
// pool (not re-created per request) lets connections be reused instead of
// opening a brand-new one on every call, which matters a lot on Supabase's
// free tier connection limits.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5 // keep this low — serverless functions can spin up many parallel instances
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
});

module.exports = pool;
