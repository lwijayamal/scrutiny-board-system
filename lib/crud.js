// Small helper that builds list / create / update / delete routes for a simple table
const express = require('express');
const pool = require('./db');
const { authenticate, authorize } = require('./middleware/auth');
const { fail, audit } = require('./util');

module.exports = function crud({ table, pk, cols, writeRoles, orderBy, listSql, manualPk }) {
  const r = express.Router();

  r.get('/', authenticate, async (req, res) => {
    try {
      const { rows } = await pool.query(listSql || `SELECT * FROM ${table} ORDER BY ${orderBy || pk}`);
      res.json(rows);
    } catch (e) { fail(res, e); }
  });

  r.post('/', authenticate, authorize(...writeRoles), async (req, res) => {
    try {
      const insertCols = (manualPk ? [pk, ...cols] : cols)
        .filter((c) => req.body[c] !== undefined && req.body[c] !== '' && req.body[c] !== null);
      if (!insertCols.length) return res.status(400).json({ error: 'No data received' });
      const sql = `INSERT INTO ${table} (${insertCols.join(',')})
                   VALUES (${insertCols.map((_, i) => '$' + (i + 1)).join(',')}) RETURNING *`;
      const { rows } = await pool.query(sql, insertCols.map((c) => req.body[c]));
      await audit(req, `Created ${table}`, table, typeof rows[0][pk] === 'number' ? rows[0][pk] : null);
      res.status(201).json(rows[0]);
    } catch (e) { fail(res, e); }
  });

  r.put('/:id', authenticate, authorize(...writeRoles), async (req, res) => {
    try {
      const upd = cols.filter((c) => req.body[c] !== undefined);
      if (!upd.length) return res.status(400).json({ error: 'No data received' });
      const vals = upd.map((c) => (req.body[c] === '' ? null : req.body[c]));
      vals.push(req.params.id);
      const sql = `UPDATE ${table} SET ${upd.map((c, i) => `${c} = $${i + 1}`).join(', ')}
                   WHERE ${pk} = $${vals.length} RETURNING *`;
      const { rows } = await pool.query(sql, vals);
      if (!rows[0]) return res.status(404).json({ error: 'Record not found' });
      await audit(req, `Updated ${table}`, table, typeof rows[0][pk] === 'number' ? rows[0][pk] : null);
      res.json(rows[0]);
    } catch (e) { fail(res, e); }
  });

  r.delete('/:id', authenticate, authorize(...writeRoles), async (req, res) => {
    try {
      const { rowCount } = await pool.query(`DELETE FROM ${table} WHERE ${pk} = $1`, [req.params.id]);
      if (!rowCount) return res.status(404).json({ error: 'Record not found' });
      await audit(req, `Deleted ${table}`, table, parseInt(req.params.id) || null);
      res.json({ deleted: true });
    } catch (e) { fail(res, e); }
  });

  return r;
};
