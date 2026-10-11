// Create (or reset) an admin login.
// Usage:  node make-admin.js admin MyNewPassword123
require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./lib/db');

const [, , username, password] = process.argv;
if (!username || !password) {
  console.log('Usage: node make-admin.js <username> <password>');
  process.exit(1);
}

(async () => {
  const hash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (username, password_hash, role, full_name)
     VALUES ($1, $2, 'admin', 'System Admin')
     ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin'`,
    [username, hash]
  );
  console.log('Done. You can now login with username:', username);
  await pool.end();
})().catch((e) => { console.error('Failed:', e.message); process.exit(1); });
