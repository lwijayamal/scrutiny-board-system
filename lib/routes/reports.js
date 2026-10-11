const express = require('express');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { fail } = require('../util');

const r = express.Router();

const REPORTS = {
  'papers':            'SELECT * FROM v_paper_overview ORDER BY exam_date, paper_id',
  'moderation':        'SELECT * FROM v_moderation_progress ORDER BY paper_id',
  'boards':            'SELECT * FROM v_board_summary ORDER BY board_date, board_id',
  'missing-documents': 'SELECT * FROM v_missing_documents ORDER BY paper_id',
  'status':            'SELECT * FROM v_status_summary ORDER BY papers DESC',
  'decisions':
    `SELECT d.decision_id, d.decision_date, d.decision_type, d.remarks,
            c.course_code, p.paper_title, b.board_name, b.board_date
     FROM scrutiny_decisions d
     JOIN scrutiny_reviews sr ON sr.review_id = d.review_id
     JOIN exam_papers p ON p.paper_id = sr.paper_id
     JOIN exam_timetable t ON t.timetable_id = p.timetable_id
     JOIN courses c ON c.course_code = t.course_code
     JOIN scrutiny_boards b ON b.board_id = sr.board_id
     ORDER BY d.decision_date DESC, d.decision_id DESC`,
  'history':
    `SELECT h.history_id, p.paper_title, h.old_status, h.new_status, h.changed_at
     FROM paper_status_history h JOIN exam_papers p ON p.paper_id = h.paper_id
     ORDER BY h.changed_at DESC, h.history_id DESC LIMIT 500`,
  'audit':
    `SELECT a.log_id, u.username, a.action, a.table_name, a.record_id, a.created_at
     FROM audit_log a LEFT JOIN users u ON u.user_id = a.user_id
     ORDER BY a.log_id DESC LIMIT 500`
};

r.get('/:name', authenticate, authorize('admin', 'hod', 'staff'), async (req, res) => {
  try {
    const sql = REPORTS[req.params.name];
    if (!sql) return res.status(404).json({ error: 'Unknown report' });
    if (req.params.name === 'audit' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the admin can view the audit log' });
    }
    const { rows } = await pool.query(sql);
    res.json(rows);
  } catch (e) { fail(res, e); }
});

module.exports = r;
