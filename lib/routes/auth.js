const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { fail, audit } = require('../util');

const r = express.Router();
const ROLES = ['admin', 'hod', 'lecturer', 'moderator', 'staff'];

async function safeCompare(plain, hash) {
  try { return await bcrypt.compare(plain, hash); } catch (e) { return false; }
}

// ---- Login ----
r.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Enter username and password' });
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    const u = rows[0];
    if (!u || !(await safeCompare(password, u.password_hash))) {
      return res.status(401).json({ error: 'Wrong username or password' });
    }
    const user = { user_id: u.user_id, username: u.username, role: u.role, full_name: u.full_name };
    const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '8h' });
    await audit({ user }, 'Login', 'users', u.user_id);
    res.json({ token, user });
  } catch (e) { fail(res, e); }
});

r.get('/me', authenticate, (req, res) => res.json(req.user));

// ---- Register: only an admin can create users (first user ever becomes admin) ----
async function registerGuard(req, res, next) {
  try {
    const n = (await pool.query('SELECT COUNT(*)::int AS n FROM users')).rows[0].n;
    if (n === 0) { req.firstUser = true; return next(); }
  } catch (e) { return fail(res, e); }
  authenticate(req, res, () => authorize('admin')(req, res, next));
}

r.post('/register', registerGuard, async (req, res) => {
  try {
    const { username, password, full_name } = req.body || {};
    let role = req.body.role;
    if (req.firstUser) role = 'admin';
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });
    if (String(password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (!ROLES.includes(role)) return res.status(400).json({ error: 'Role must be one of: ' + ROLES.join(', ') });
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO users (username, password_hash, role, full_name)
       VALUES ($1,$2,$3,$4) RETURNING user_id, username, role, full_name`,
      [username.trim(), hash, role, full_name || null]
    );
    await audit(req, 'Created user ' + rows[0].username, 'users', rows[0].user_id);
    res.status(201).json(rows[0]);
  } catch (e) { fail(res, e); }
});

// ---- User management ----
r.get('/users', authenticate, authorize('admin', 'hod'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT user_id, username, role, full_name, created_at FROM users ORDER BY user_id');
    res.json(rows);
  } catch (e) { fail(res, e); }
});

r.put('/users/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const sets = []; const vals = [];
    if (req.body.role) {
      if (!ROLES.includes(req.body.role)) return res.status(400).json({ error: 'Invalid role' });
      vals.push(req.body.role); sets.push(`role = $${vals.length}`);
    }
    if (req.body.full_name !== undefined) { vals.push(req.body.full_name); sets.push(`full_name = $${vals.length}`); }
    if (req.body.password) {
      if (String(req.body.password).length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
      vals.push(await bcrypt.hash(req.body.password, 10)); sets.push(`password_hash = $${vals.length}`);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE users SET ${sets.join(', ')} WHERE user_id = $${vals.length}
       RETURNING user_id, username, role, full_name`, vals);
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    await audit(req, 'Updated user ' + rows[0].username, 'users', rows[0].user_id);
    res.json(rows[0]);
  } catch (e) { fail(res, e); }
});

r.delete('/users/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    if (parseInt(req.params.id) === req.user.user_id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    const { rowCount } = await pool.query('DELETE FROM users WHERE user_id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'User not found' });
    await audit(req, 'Deleted user id ' + req.params.id, 'users', parseInt(req.params.id));
    res.json({ deleted: true });
  } catch (e) { fail(res, e); }
});

module.exports = r;
