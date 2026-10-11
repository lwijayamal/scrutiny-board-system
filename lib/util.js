const pool = require('./db');

// Turn database errors (including our trigger messages) into friendly JSON
function fail(res, e) {
  console.error('DB/API error:', e.message);
  if (e.code === 'P0001') return res.status(400).json({ error: e.message });   // business-rule trigger
  const map = {
    '23505': 'This record already exists (duplicate value).',
    '23503': 'A related record is missing, or this record is still used by other records.',
    '23514': 'A value breaks a database rule (check dates, times and values).',
    '23502': 'A required field is empty.',
    '22P02': 'A value has the wrong format.',
    '22007': 'Invalid date or time format.',
    '22008': 'Invalid date or time value.'
  };
  if (map[e.code]) {
    return res.status(400).json({ error: map[e.code] + (e.constraint ? ` [${e.constraint}]` : '') });
  }
  res.status(500).json({ error: 'Server error: ' + e.message });
}

async function audit(req, action, table, id) {
  try {
    await pool.query(
      'INSERT INTO audit_log (user_id, action, table_name, record_id) VALUES ($1,$2,$3,$4)',
      [req.user ? req.user.user_id : null, String(action).slice(0, 200), table || null, id || null]
    );
  } catch (e) { console.error('audit failed:', e.message); }
}

// Lecturers see only their own papers, moderators only the papers assigned to them.
// Returns an SQL condition (alias p = exam_papers) or null for other roles.
function scope(req, params) {
  if (req.user.role === 'lecturer') {
    params.push(req.user.user_id);
    return `p.lecturer_id IN (SELECT lecturer_id FROM lecturers WHERE user_id = $${params.length})`;
  }
  if (req.user.role === 'moderator') {
    params.push(req.user.user_id);
    return `p.moderator_id IN (SELECT moderator_id FROM moderators WHERE user_id = $${params.length})`;
  }
  return null;
}

async function canAccess(req, paperId) {
  const params = [paperId];
  const cond = scope(req, params);
  const { rows } = await pool.query(
    `SELECT 1 FROM exam_papers p WHERE p.paper_id = $1 ${cond ? 'AND ' + cond : ''}`,
    params
  );
  return rows.length > 0;
}

module.exports = { fail, audit, scope, canAccess };
