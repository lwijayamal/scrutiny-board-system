// The scrutiny workflow: moderation, revisions, documents, HOD verification, review, decision
const express = require('express');
const pool = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const { fail, audit, canAccess } = require('../util');

const r = express.Router();

async function getPaper(id) {
  const { rows } = await pool.query('SELECT * FROM exam_papers WHERE paper_id = $1', [id]);
  return rows[0];
}

// Validates the :id and checks that this user may see the paper. Returns the id or null.
async function guard(req, res) {
  const id = parseInt(req.params.id);
  if (!Number.isInteger(id)) { res.status(400).json({ error: 'Bad paper id' }); return null; }
  if (!(await canAccess(req, id))) { res.status(404).json({ error: 'Paper not found' }); return null; }
  return id;
}

// ---------- 1. Send paper for moderation (creates moderation cycle 1) ----------
r.post('/papers/:id/submit-moderation', authenticate,
  authorize('admin', 'hod', 'staff', 'lecturer'), async (req, res) => {
  try {
    const id = await guard(req, res); if (!id) return;
    const p = await getPaper(id);
    if (p.status !== 'Pending Moderation') {
      return res.status(400).json({ error: `This paper is already in the process (status: ${p.status})` });
    }
    const d = await pool.query(
      `SELECT document_type FROM documents
       WHERE paper_id = $1 AND availability_status = 'Available'
         AND document_type IN ('Examination Paper','Marking Scheme')`, [id]);
    if (d.rows.length < 2) {
      return res.status(400).json({ error: 'Mark the Examination Paper and the Marking Scheme as Available first' });
    }
    const { rows } = await pool.query(
      'INSERT INTO moderation_cycles (paper_id, cycle_no) VALUES ($1, 1) RETURNING *', [id]);
    await audit(req, 'Paper sent for moderation', 'exam_papers', id);
    res.status(201).json(rows[0]);
  } catch (e) { fail(res, e); }
});

// ---------- 2. Revise and resubmit (new revision + next moderation cycle) ----------
r.post('/papers/:id/resubmit', authenticate,
  authorize('admin', 'hod', 'staff', 'lecturer'), async (req, res) => {
  let client;
  try {
    const id = await guard(req, res); if (!id) return;
    const details = (req.body && req.body.revision_details || '').trim();
    if (!details) return res.status(400).json({ error: 'Describe what was revised' });
    const p = await getPaper(id);
    if (p.status !== 'Revision Required') {
      return res.status(400).json({ error: `Resubmission is only possible when status is Revision Required (now: ${p.status})` });
    }
    const last = (await pool.query(
      'SELECT * FROM moderation_cycles WHERE paper_id = $1 ORDER BY cycle_no DESC LIMIT 1', [id])).rows[0];
    if (!last) return res.status(400).json({ error: 'No moderation cycle found for this paper' });

    client = await pool.connect();
    await client.query('BEGIN');
    // coming back from a scrutiny board: free the board so the paper can be re-assigned later
    await client.query('UPDATE exam_papers SET board_id = NULL WHERE paper_id = $1 AND board_id IS NOT NULL', [id]);
    const rn = (await client.query(
      'SELECT COALESCE(MAX(revision_no),0) + 1 AS n FROM revisions WHERE paper_id = $1', [id])).rows[0].n;
    await client.query(
      'INSERT INTO revisions (paper_id, cycle_id, revision_no, revision_details) VALUES ($1,$2,$3,$4)',
      [id, last.cycle_id, rn, details]);
    await client.query(
      `UPDATE documents SET availability_status = 'Available', submission_date = CURRENT_DATE
       WHERE paper_id = $1 AND document_type = 'Examination Paper'`, [id]);
    await client.query(   // a new moderation round needs a new moderator report
      `UPDATE documents SET availability_status = 'Missing', submission_date = NULL
       WHERE paper_id = $1 AND document_type = 'Moderator Report'`, [id]);
    const c = await client.query(
      'INSERT INTO moderation_cycles (paper_id, cycle_no) VALUES ($1,$2) RETURNING *',
      [id, last.cycle_no + 1]);
    await client.query('COMMIT');
    await audit(req, 'Paper revised and resubmitted', 'exam_papers', id);
    res.status(201).json(c.rows[0]);
  } catch (e) {
    if (client) { try { await client.query('ROLLBACK'); } catch (x) { /* ignore */ } }
    fail(res, e);
  } finally { if (client) client.release(); }
});

// ---------- 3. Moderator reviews a cycle ----------
r.put('/cycles/:cid', authenticate, authorize('admin', 'hod', 'moderator'), async (req, res) => {
  try {
    const cid = parseInt(req.params.cid);
    const { rows: found } = await pool.query(
      `SELECT mc.*, m.user_id AS moderator_user
       FROM moderation_cycles mc
       JOIN exam_papers p ON p.paper_id = mc.paper_id
       LEFT JOIN moderators m ON m.moderator_id = p.moderator_id
       WHERE mc.cycle_id = $1`, [cid]);
    const cyc = found[0];
    if (!cyc) return res.status(404).json({ error: 'Moderation cycle not found' });
    if (req.user.role === 'moderator' && cyc.moderator_user !== req.user.user_id) {
      return res.status(403).json({ error: 'This paper is not assigned to you' });
    }
    if (cyc.status !== 'Pending Review') {
      return res.status(400).json({ error: 'This cycle has already been reviewed' });
    }
    const { status, comments, recommendations, required_corrections, review_date } = req.body || {};
    if (!['Corrections Required', 'Completed'].includes(status)) {
      return res.status(400).json({ error: 'Choose "Corrections Required" or "Completed"' });
    }
    if (status === 'Corrections Required' && !(required_corrections || '').trim()) {
      return res.status(400).json({ error: 'Write the required corrections' });
    }
    const { rows } = await pool.query(
      `UPDATE moderation_cycles
       SET status = $1, review_date = COALESCE($2::date, CURRENT_DATE),
           comments = $3, recommendations = $4, required_corrections = $5
       WHERE cycle_id = $6 RETURNING *`,
      [status, review_date || null, comments || null, recommendations || null,
       required_corrections || null, cid]);
    if (status === 'Completed') {   // a completed cycle produces the moderator's report
      await pool.query(
        `UPDATE documents SET availability_status = 'Available', submission_date = CURRENT_DATE, cycle_id = $2
         WHERE paper_id = $1 AND document_type = 'Moderator Report'`, [cyc.paper_id, cid]);
    }
    await audit(req, 'Moderation cycle ' + status, 'moderation_cycles', cid);
    res.json(rows[0]);
  } catch (e) { fail(res, e); }
});

// ---------- 4. Documents: mark Available / Missing ----------
r.put('/documents/:did', authenticate,
  authorize('admin', 'hod', 'staff', 'lecturer', 'moderator'), async (req, res) => {
  try {
    const did = parseInt(req.params.did);
    const { rows: found } = await pool.query('SELECT * FROM documents WHERE document_id = $1', [did]);
    const doc = found[0];
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (!(await canAccess(req, doc.paper_id))) return res.status(404).json({ error: 'Paper not found' });
    if (req.user.role === 'lecturer' && doc.document_type === 'Moderator Report') {
      return res.status(403).json({ error: 'Only the moderator can provide the Moderator Report' });
    }
    if (req.user.role === 'moderator' && doc.document_type !== 'Moderator Report') {
      return res.status(403).json({ error: 'Moderators can only update the Moderator Report' });
    }
    const status = req.body.availability_status;
    if (!['Available', 'Missing'].includes(status)) {
      return res.status(400).json({ error: 'Status must be Available or Missing' });
    }
    const dateSql = status === 'Available' ? 'COALESCE(submission_date, CURRENT_DATE)' : 'NULL';
    const url = req.body.file_url ? req.body.file_url : null;
    const { rows } = await pool.query(
      `UPDATE documents SET availability_status = $1, submission_date = ${dateSql},
              file_url = COALESCE($2, file_url)
       WHERE document_id = $3 RETURNING *`, [status, url, did]);
    if (doc.document_type === 'Marking Scheme') {
      await pool.query(
        `UPDATE marking_schemes SET submission_status = $1,
                submission_date = ${status === 'Available' ? 'COALESCE(submission_date, CURRENT_DATE)' : 'NULL'}
         WHERE paper_id = $2`,
        [status === 'Available' ? 'Submitted' : 'Not Submitted', doc.paper_id]);
    }
    if (doc.document_type === 'Examination Paper' && status === 'Available') {
      await pool.query(
        'UPDATE exam_papers SET submission_date = COALESCE(submission_date, CURRENT_DATE) WHERE paper_id = $1',
        [doc.paper_id]);
    }
    await audit(req, `${doc.document_type} marked ${status}`, 'documents', did);
    res.json(rows[0]);
  } catch (e) { fail(res, e); }
});

// ---------- 5. HOD verification (database trigger checks moderation + documents) ----------
r.post('/papers/:id/verify', authenticate, authorize('admin', 'hod'), async (req, res) => {
  try {
    const id = await guard(req, res); if (!id) return;
    const p = await getPaper(id);
    if (p.status !== 'Moderation Completed') {
      return res.status(400).json({ error: `Verification is possible only when status is Moderation Completed (now: ${p.status})` });
    }
    let hodId = null;
    const h = await pool.query('SELECT hod_id FROM hods WHERE user_id = $1', [req.user.user_id]);
    if (h.rows[0]) hodId = h.rows[0].hod_id;
    else if (req.user.role === 'admin' && req.body.hod_id) hodId = parseInt(req.body.hod_id);
    if (!hodId) {
      return res.status(400).json({ error: 'Your login is not linked to a HOD record. Ask the admin to link it on the HODs page (or choose a HOD if you are admin).' });
    }
    const result = req.body.result === 'Not Verified' ? 'Not Verified' : 'Verified';
    const { rows } = await pool.query(
      `INSERT INTO hod_verifications (paper_id, hod_id, result, remarks)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [id, hodId, result, req.body.remarks || null]);
    await audit(req, 'HOD verification: ' + result, 'hod_verifications', rows[0].verification_id);
    res.status(201).json(rows[0]);
  } catch (e) { fail(res, e); }
});

// ---------- 6. Scrutiny Board review ----------
r.post('/papers/:id/review', authenticate, authorize('admin', 'hod'), async (req, res) => {
  try {
    const id = await guard(req, res); if (!id) return;
    const p = await getPaper(id);
    if (p.status !== 'Under Scrutiny' || !p.board_id) {
      return res.status(400).json({ error: 'The paper must be assigned to a board (status Under Scrutiny) before a review' });
    }
    const { rows } = await pool.query(
      `INSERT INTO scrutiny_reviews (board_id, paper_id, observations, comments)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [p.board_id, id, req.body.observations || null, req.body.comments || null]);
    await audit(req, 'Scrutiny review recorded', 'scrutiny_reviews', rows[0].review_id);
    res.status(201).json(rows[0]);
  } catch (e) { fail(res, e); }
});

// ---------- 7. Scrutiny decision (trigger updates the paper status) ----------
r.post('/reviews/:rid/decision', authenticate, authorize('admin', 'hod'), async (req, res) => {
  try {
    const type = req.body.decision_type;
    if (!['Approved', 'Corrections Required', 'Rejected'].includes(type)) {
      return res.status(400).json({ error: 'Decision must be Approved, Corrections Required or Rejected' });
    }
    const { rows } = await pool.query(
      'INSERT INTO scrutiny_decisions (review_id, decision_type, remarks) VALUES ($1,$2,$3) RETURNING *',
      [req.params.rid, type, req.body.remarks || null]);
    res.status(201).json(rows[0]);
  } catch (e) { fail(res, e); }
});

module.exports = r;
