const express = require('express');
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/cases?meeting_id=1 -> list cases (optionally filtered by meeting)
router.get('/', authenticate, async (req, res) => {
  try {
    const { meeting_id } = req.query;
    let query = `
      SELECT c.case_id, c.case_type, c.created_at,
             s.student_id, s.name AS student_name, s.reg_no,
             m.meeting_id, m.meeting_date
      FROM student_cases c
      JOIN students s ON c.student_id = s.student_id
      JOIN meetings m ON c.meeting_id = m.meeting_id`;
    const params = [];
    if (meeting_id) {
      query += ' WHERE c.meeting_id = $1';
      params.push(meeting_id);
    }
    query += ' ORDER BY c.case_id';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch cases' });
  }
});

// POST /api/cases -> add a student case to a meeting
router.post('/', authenticate, authorize('admin', 'chair', 'board_member', 'staff'), async (req, res) => {
  try {
    const { meeting_id, student_id, case_type } = req.body;
    if (!meeting_id || !student_id) {
      return res.status(400).json({ error: 'meeting_id and student_id are required' });
    }
    const result = await pool.query(
      `INSERT INTO student_cases (meeting_id, student_id, case_type)
       VALUES ($1, $2, $3) RETURNING *`,
      [meeting_id, student_id, case_type || 'Normal']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create case' });
  }
});

// GET /api/cases/:id/decisions -> decision history for a case
router.get('/:id/decisions', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM decisions WHERE case_id = $1 ORDER BY decision_date DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch decisions' });
  }
});

// POST /api/cases/:id/decisions -> record a decision (chair/board_member only)
// Marks any previous decision for this case as not-current, then inserts the new one.
router.post('/:id/decisions', authenticate, authorize('admin', 'chair', 'board_member'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { decision_type, remarks } = req.body;
    if (!decision_type) return res.status(400).json({ error: 'decision_type is required' });

    await client.query('BEGIN');
    await client.query(
      `UPDATE decisions SET is_current = FALSE WHERE case_id = $1`,
      [req.params.id]
    );
    const result = await client.query(
      `INSERT INTO decisions (case_id, decision_type, remarks, is_current)
       VALUES ($1, $2, $3, TRUE) RETURNING *`,
      [req.params.id, decision_type, remarks || null]
    );
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to record decision' });
  } finally {
    client.release();
  }
});

module.exports = router;
