const express = require('express');
const pool = require('../db/pool');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/students  -> list all students
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.student_id, s.reg_no, s.name, s.batch, s.email, f.faculty_name
       FROM students s JOIN faculties f ON s.faculty_id = f.faculty_id
       ORDER BY s.student_id`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// GET /api/students/:id -> one student + their exam results
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const student = await pool.query('SELECT * FROM students WHERE student_id = $1', [id]);
    if (student.rows.length === 0) return res.status(404).json({ error: 'Student not found' });

    const results = await pool.query(
      `SELECT r.result_id, m.module_name, r.semester, r.marks, r.grade
       FROM exam_results r JOIN modules m ON r.module_id = m.module_id
       WHERE r.student_id = $1 ORDER BY r.semester`,
      [id]
    );
    res.json({ ...student.rows[0], results: results.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
});

// POST /api/students -> create (staff/admin only)
router.post('/', authenticate, authorize('admin', 'staff'), async (req, res) => {
  try {
    const { reg_no, name, faculty_id, batch, email } = req.body;
    if (!reg_no || !name || !faculty_id) {
      return res.status(400).json({ error: 'reg_no, name, and faculty_id are required' });
    }
    const result = await pool.query(
      `INSERT INTO students (reg_no, name, faculty_id, batch, email)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [reg_no, name, faculty_id, batch || null, email || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'reg_no already exists' });
    console.error(err);
    res.status(500).json({ error: 'Failed to create student' });
  }
});

module.exports = router;
