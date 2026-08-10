const express = require('express');
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/boards -> list all scrutiny boards
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT b.board_id, b.academic_year, b.semester, f.faculty_name
       FROM scrutiny_boards b JOIN faculties f ON b.faculty_id = f.faculty_id
       ORDER BY b.board_id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch boards' });
  }
});

// POST /api/boards -> create a board (admin/chair only)
router.post('/', authenticate, authorize('admin', 'chair'), async (req, res) => {
  try {
    const { faculty_id, academic_year, semester } = req.body;
    const result = await pool.query(
      `INSERT INTO scrutiny_boards (faculty_id, academic_year, semester)
       VALUES ($1, $2, $3) RETURNING *`,
      [faculty_id, academic_year, semester]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create board' });
  }
});

// GET /api/boards/:id/meetings -> meetings for a board
router.get('/:id/meetings', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM meetings WHERE board_id = $1 ORDER BY meeting_date`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch meetings' });
  }
});

// POST /api/boards/:id/meetings -> schedule a meeting
router.post('/:id/meetings', authenticate, authorize('admin', 'chair'), async (req, res) => {
  try {
    const { meeting_date, venue } = req.body;
    const result = await pool.query(
      `INSERT INTO meetings (board_id, meeting_date, venue) VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, meeting_date, venue || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to schedule meeting' });
  }
});

module.exports = router;
