const express = require('express');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { fail, audit, scope, canAccess } = require('../util');

const r = express.Router();

const BASE = `SELECT v.*, p.lecturer_id, p.moderator_id, p.timetable_id
              FROM v_paper_overview v
              JOIN exam_papers p ON p.paper_id = v.paper_id`;

const DOC_TYPES = ['Examination Paper', 'Marking Scheme', 'Moderator Report'];

// ---- List papers (lecturers / moderators only see their own) ----
r.get('/', authenticate, async (req, res) => {
  try {
    const params = []; const where = [];
    const sc = scope(req, params);
    if (sc) where.push(sc);
    if (req.query.status) { params.push(req.query.status); where.push(`v.status = $${params.length}`); }
    if (req.query.board_id) { params.push(parseInt(req.query.board_id)); where.push(`v.board_id = $${params.length}`); }
    const sql = BASE + (where.length ? ' WHERE ' + where.join(' AND ') : '') +
                ' ORDER BY v.exam_date, v.paper_id';
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) { fail(res, e); }
});

// ---- One paper with its full history ----
r.get('/:id', authenticate, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Bad paper id' });
    if (!(await canAccess(req, id))) return res.status(404).json({ error: 'Paper not found' });
    const q = async (sql) => (await pool.query(sql, [id])).rows;
    const paper = await q(`${BASE} WHERE p.paper_id = $1`);
    const scheme = await q('SELECT * FROM marking_schemes WHERE paper_id = $1');
    const documents = await q('SELECT * FROM documents WHERE paper_id = $1 ORDER BY document_id');
    const cycles = await q('SELECT * FROM moderation_cycles WHERE paper_id = $1 ORDER BY cycle_no');
    const revisions = await q('SELECT * FROM revisions WHERE paper_id = $1 ORDER BY revision_no');
    const verifications = await q(
      `SELECT hv.*, h.name AS hod_name FROM hod_verifications hv
       JOIN hods h ON h.hod_id = hv.hod_id WHERE hv.paper_id = $1 ORDER BY hv.verification_id`);
    const reviews = await q(
      `SELECT sr.*, b.board_name, b.board_date,
              d.decision_id, d.decision_type, d.decision_date, d.remarks AS decision_remarks
       FROM scrutiny_reviews sr
       JOIN scrutiny_boards b ON b.board_id = sr.board_id
       LEFT JOIN scrutiny_decisions d ON d.review_id = sr.review_id
       WHERE sr.paper_id = $1 ORDER BY sr.review_id`);
    const history = await q('SELECT * FROM paper_status_history WHERE paper_id = $1 ORDER BY history_id');
    if (!paper[0]) return res.status(404).json({ error: 'Paper not found' });
    res.json({ paper: paper[0], scheme: scheme[0] || null, documents, cycles, revisions, verifications, reviews, history });
  } catch (e) { fail(res, e); }
});

// ---- Create paper (also creates the marking-scheme record and the 3 required document rows) ----
r.post('/', authenticate, authorize('admin', 'hod', 'staff'), async (req, res) => {
  const { timetable_id, paper_title, lecturer_id, moderator_id } = req.body || {};
  if (!timetable_id || !paper_title || !lecturer_id) {
    return res.status(400).json({ error: 'Timetable entry, paper title and lecturer are required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO exam_papers (timetable_id, paper_title, lecturer_id, moderator_id)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [timetable_id, paper_title, lecturer_id, moderator_id || null]);
    const paper = rows[0];
    await client.query('INSERT INTO marking_schemes (paper_id) VALUES ($1)', [paper.paper_id]);
    for (const t of DOC_TYPES) {
      await client.query('INSERT INTO documents (paper_id, document_type) VALUES ($1,$2)', [paper.paper_id, t]);
    }
    await client.query('COMMIT');
    await audit(req, 'Created exam paper', 'exam_papers', paper.paper_id);
    res.status(201).json(paper);
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (x) { /* ignore */ }
    fail(res, e);
  } finally { client.release(); }
});

// ---- Edit title / lecturer / moderator ----
r.put('/:id', authenticate, authorize('admin', 'hod', 'staff'), async (req, res) => {
  try {
    const cols = ['paper_title', 'lecturer_id', 'moderator_id'];
    const upd = cols.filter((c) => req.body[c] !== undefined);
    if (!upd.length) return res.status(400).json({ error: 'Nothing to update' });
    const vals = upd.map((c) => (req.body[c] === '' ? null : req.body[c]));
    vals.push(req.params.id);
    const { rows } = await pool.query(
      `UPDATE exam_papers SET ${upd.map((c, i) => `${c} = $${i + 1}`).join(', ')}
       WHERE paper_id = $${vals.length} RETURNING *`, vals);
    if (!rows[0]) return res.status(404).json({ error: 'Paper not found' });
    await audit(req, 'Updated exam paper', 'exam_papers', rows[0].paper_id);
    res.json(rows[0]);
  } catch (e) { fail(res, e); }
});

r.delete('/:id', authenticate, authorize('admin', 'hod'), async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM exam_papers WHERE paper_id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Paper not found' });
    await audit(req, 'Deleted exam paper id ' + req.params.id, 'exam_papers', parseInt(req.params.id));
    res.json({ deleted: true });
  } catch (e) { fail(res, e); }
});

// ---- Assign paper to a Scrutiny Board (database trigger checks "Ready for Scrutiny") ----
r.put('/:id/board', authenticate, authorize('admin', 'hod'), async (req, res) => {
  try {
    const boardId = req.body.board_id === '' || req.body.board_id === undefined ? null : req.body.board_id;
    const { rows } = await pool.query(
      'UPDATE exam_papers SET board_id = $1 WHERE paper_id = $2 RETURNING *',
      [boardId, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Paper not found' });
    await audit(req, 'Assigned paper to board ' + boardId, 'exam_papers', rows[0].paper_id);
    res.json(rows[0]);
  } catch (e) { fail(res, e); }
});

module.exports = r;
