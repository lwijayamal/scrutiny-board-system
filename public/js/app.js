/* Scrutiny Board Management System - dashboard logic (plain JavaScript, no build step) */

if (!Auth.token || !Auth.user) { location.href = 'index.html'; }
const ME = Auth.user || {};
const ROLE = ME.role;

const $ = (s) => document.querySelector(s);
const esc = (v) => (v === null || v === undefined) ? '' :
  String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fmt(v) {
  if (v === null || v === undefined || v === '') return '-';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  const s = String(v);
  if (/^\d{4}-\d\d-\d\dT/.test(s)) return esc(s.replace('T', ' ').slice(0, 16));
  if (/^\d\d:\d\d:\d\d$/.test(s)) return s.slice(0, 5);
  return esc(s);
}
function badge(status) {
  if (!status) return '-';
  return `<span class="badge s-${String(status).toLowerCase().replace(/[^a-z]+/g, '-')}">${esc(status)}</span>`;
}
function toast(msg, bad) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = bad ? 'bad' : '';
  t.style.display = 'block';
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.style.display = 'none'; }, bad ? 6000 : 2500);
}
function card(title, body) { return `<div class="card">${title ? `<h3>${title}</h3>` : ''}${body}</div>`; }
function table(headers, rows) {
  if (!rows.length) return '<p class="muted">No records.</p>';
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function opt(value, label, selected) {
  return `<option value="${esc(value)}"${selected ? ' selected' : ''}>${esc(label)}</option>`;
}
// run an action, show a message, then refresh the current page
async function act(fn, okMsg) {
  try { await fn(); toast(okMsg || 'Saved'); } catch (e) { toast(e.message, true); return; }
  route();
}
function on(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', () => act(fn));
}
const val = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };

/* ------------------------------------------------------------------ */
/*  Menu                                                               */
/* ------------------------------------------------------------------ */
const MENU = [
  { id: 'dashboard', label: 'Dashboard', roles: null },
  { id: 'papers', label: 'Exam Papers', roles: null },
  { id: 'examinations', label: 'Examinations', roles: ['admin', 'hod', 'staff'] },
  { id: 'timetable', label: 'Exam Timetable', roles: ['admin', 'hod', 'staff'] },
  { id: 'courses', label: 'Courses', roles: ['admin', 'hod', 'staff'] },
  { id: 'lecturers', label: 'Lecturers', roles: ['admin', 'hod', 'staff'] },
  { id: 'moderators', label: 'Moderators', roles: ['admin', 'hod', 'staff'] },
  { id: 'hods', label: 'Heads of Dept.', roles: ['admin', 'hod'] },
  { id: 'boards', label: 'Scrutiny Boards', roles: ['admin', 'hod', 'staff'] },
  { id: 'reports', label: 'Reports', roles: ['admin', 'hod', 'staff'] },
  { id: 'users', label: 'Users', roles: ['admin'] }
];
const visibleMenu = MENU.filter((m) => !m.roles || m.roles.includes(ROLE));

function buildMenu() {
  $('#sidebar').innerHTML = visibleMenu.map((m) => `<a href="#${m.id}" data-id="${m.id}">${esc(m.label)}</a>`).join('');
  $('#whoami').textContent = `${ME.full_name || ME.username} (${ROLE})`;
}

/* ------------------------------------------------------------------ */
/*  Simple master-data pages (generic table + form)                    */
/* ------------------------------------------------------------------ */
const EDITORS = ['admin', 'hod', 'staff'];
const ENTITIES = {
  examinations: {
    title: 'Examinations', path: '/examinations', pk: 'exam_id', roles: EDITORS,
    cols: [['academic_year', 'Academic Year'], ['semester', 'Semester'], ['exam_name', 'Exam Name'], ['exam_type', 'Type']],
    fields: [
      { k: 'academic_year', l: 'Academic Year', ph: '2025/2026', req: 1 },
      { k: 'semester', l: 'Semester', ph: 'Semester 1', req: 1 },
      { k: 'exam_name', l: 'Examination Name', req: 1 },
      { k: 'exam_type', l: 'Examination Type', t: 'select', opts: ['End Semester', 'Mid Semester', 'Repeat', 'Supplementary'], req: 1 }
    ]
  },
  courses: {
    title: 'Courses', path: '/courses', pk: 'course_code', roles: EDITORS,
    cols: [['course_code', 'Course Code'], ['course_name', 'Course Name']],
    fields: [
      { k: 'course_code', l: 'Course Code', ph: 'ICT1212', req: 1, pkField: 1 },
      { k: 'course_name', l: 'Course Name', req: 1 }
    ]
  },
  timetable: {
    title: 'Examination Timetable', path: '/timetable', pk: 'timetable_id', roles: EDITORS,
    cols: [['exam_name', 'Examination'], ['course_code', 'Course Code'], ['course_name', 'Course Name'],
           ['exam_date', 'Date'], ['start_time', 'Start'], ['end_time', 'End']],
    fields: [
      { k: 'exam_id', l: 'Examination', t: 'ref', src: '/examinations', v: 'exam_id', lb: (r) => `${r.exam_name} (${r.academic_year})`, req: 1 },
      { k: 'course_code', l: 'Course', t: 'ref', src: '/courses', v: 'course_code', lb: (r) => `${r.course_code} - ${r.course_name}`, req: 1 },
      { k: 'exam_date', l: 'Exam Date', t: 'date', req: 1 },
      { k: 'start_time', l: 'Start Time', t: 'time', req: 1 },
      { k: 'end_time', l: 'End Time', t: 'time', req: 1 }
    ]
  },
  lecturers: {
    title: 'Lecturers', path: '/lecturers', pk: 'lecturer_id', roles: ['admin', 'hod'],
    cols: [['lecturer_id', 'ID'], ['name', 'Name'], ['email', 'Email'], ['contact_no', 'Contact No'], ['username', 'Login user']],
    fields: [
      { k: 'name', l: 'Name', req: 1 },
      { k: 'email', l: 'Email' },
      { k: 'contact_no', l: 'Contact Number' },
      { k: 'user_id', l: 'Login account (optional)', t: 'ref', src: '/auth/users', v: 'user_id', lb: (r) => `${r.username} (${r.role})` }
    ]
  },
  moderators: {
    title: 'Moderators', path: '/moderators', pk: 'moderator_id', roles: ['admin', 'hod'],
    cols: [['moderator_id', 'ID'], ['name', 'Name'], ['email', 'Email'], ['contact_no', 'Contact No'], ['department', 'Department'], ['username', 'Login user']],
    fields: [
      { k: 'name', l: 'Name', req: 1 },
      { k: 'email', l: 'Email' },
      { k: 'contact_no', l: 'Contact Number' },
      { k: 'department', l: 'Department' },
      { k: 'user_id', l: 'Login account (optional)', t: 'ref', src: '/auth/users', v: 'user_id', lb: (r) => `${r.username} (${r.role})` }
    ]
  },
  hods: {
    title: 'Heads of Department', path: '/hods', pk: 'hod_id', roles: ['admin'],
    cols: [['hod_id', 'ID'], ['name', 'Name'], ['email', 'Email'], ['department', 'Department'], ['username', 'Login user']],
    fields: [
      { k: 'name', l: 'Name', req: 1 },
      { k: 'email', l: 'Email' },
      { k: 'department', l: 'Department' },
      { k: 'user_id', l: 'Login account (optional)', t: 'ref', src: '/auth/users', v: 'user_id', lb: (r) => `${r.username} (${r.role})` }
    ]
  },
  boards: {
    title: 'Scrutiny Boards', path: '/boards', pk: 'board_id', roles: ['admin', 'hod'], open: 'board',
    cols: [['board_id', 'ID'], ['board_name', 'Board'], ['board_date', 'Board Date'], ['submission_deadline', 'Submission Deadline'],
           ['papers_assigned', 'Papers'], ['approved', 'Approved'], ['rejected', 'Rejected'],
           ['corrections_required', 'Corrections'], ['pending_decision', 'Pending']],
    fields: [
      { k: 'board_name', l: 'Board Name', ph: 'Board 1' },
      { k: 'board_date', l: 'Board Date', t: 'date', req: 1 },
      { k: 'submission_deadline', l: 'Submission Deadline', t: 'date', req: 1 }
    ]
  }
};

async function viewEntity(key) {
  const E = ENTITIES[key];
  const canWrite = E.roles.includes(ROLE);
  const rows = await api(E.path);
  const refs = {};
  if (canWrite) {
    for (const f of E.fields) if (f.t === 'ref') refs[f.k] = await api(f.src);
  }
  let editing = null;   // primary-key value of the row being edited

  function fieldHtml(f) {
    const id = 'f_' + f.k;
    if (f.t === 'select') return `<select id="${id}">${f.opts.map((o) => opt(o, o)).join('')}</select>`;
    if (f.t === 'ref') {
      return `<select id="${id}"><option value="">-- select --</option>${
        refs[f.k].map((r) => opt(r[f.v], f.lb(r))).join('')}</select>`;
    }
    return `<input id="${id}" type="${f.t || 'text'}" placeholder="${esc(f.ph || '')}">`;
  }

  let html = `<h2>${esc(E.title)}</h2>`;
  if (canWrite) {
    html += card('<span id="formTitle">Add new</span>',
      `<div class="form-grid">${E.fields.map((f) =>
        `<div><label>${esc(f.l)}${f.req ? ' *' : ''}</label>${fieldHtml(f)}</div>`).join('')}</div>
       <p><button class="btn primary" id="saveBtn">Save</button>
          <button class="btn" id="cancelBtn" style="display:none">Cancel edit</button></p>`);
  }
  html += card('', table(
    E.cols.map((c) => c[1]).concat(canWrite || E.open ? ['Actions'] : []),
    rows.map((r) => E.cols.map((c) => fmt(r[c[0]])).concat(canWrite || E.open ? [
      (E.open ? `<a class="btn small" href="#${E.open}/${esc(r[E.pk])}">Open</a>` : '') +
      (canWrite ? `<button class="btn small" data-edit="${esc(r[E.pk])}">Edit</button>
                   <button class="btn small danger" data-del="${esc(r[E.pk])}">Delete</button>` : '')
    ] : []))));
  $('#view').innerHTML = html;
  if (!canWrite) return;

  const resetForm = () => {
    editing = null;
    E.fields.forEach((f) => {
      const el = $('#f_' + f.k);
      if (f.t === 'select') el.selectedIndex = 0; else el.value = '';
      el.disabled = false;
    });
    $('#formTitle').textContent = 'Add new';
    $('#cancelBtn').style.display = 'none';
  };
  $('#cancelBtn').addEventListener('click', resetForm);

  $('#saveBtn').addEventListener('click', () => act(async () => {
    const body = {};
    for (const f of E.fields) {
      const v = $('#f_' + f.k).value.trim();
      if (f.req && !v && !(editing !== null && f.pkField)) throw new Error(`${f.l} is required`);
      body[f.k] = v;
    }
    if (editing !== null) await api(`${E.path}/${encodeURIComponent(editing)}`, 'PUT', body);
    else await api(E.path, 'POST', body);
  }));

  document.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => {
    const row = rows.find((r) => String(r[E.pk]) === b.dataset.edit);
    editing = row[E.pk];
    E.fields.forEach((f) => {
      const el = $('#f_' + f.k);
      el.value = row[f.k] === null || row[f.k] === undefined ? '' : String(row[f.k]).slice(0, f.t === 'time' ? 5 : 100);
      if (f.pkField) el.disabled = true;
    });
    $('#formTitle').textContent = 'Edit record';
    $('#cancelBtn').style.display = 'inline-block';
    window.scrollTo(0, 0);
  }));
  document.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    if (!confirm('Delete this record?')) return;
    act(() => api(`${E.path}/${encodeURIComponent(b.dataset.del)}`, 'DELETE'), 'Deleted');
  }));
}

/* ------------------------------------------------------------------ */
/*  Dashboard                                                          */
/* ------------------------------------------------------------------ */
const STATUSES = ['Pending Moderation', 'Under Moderation', 'Revision Required', 'Moderation Completed',
                  'Ready for Scrutiny', 'Under Scrutiny', 'Approved', 'Rejected'];
const ATTENTION = {
  lecturer: ['Pending Moderation', 'Revision Required'],
  moderator: ['Under Moderation'],
  hod: ['Moderation Completed', 'Ready for Scrutiny', 'Under Scrutiny'],
  admin: ['Moderation Completed', 'Ready for Scrutiny', 'Under Scrutiny'],
  staff: ['Pending Moderation']
};

function paperRows(list) {
  return list.map((p) => [
    esc(p.course_code), esc(p.paper_title), fmt(p.exam_date), esc(p.lecturer), fmt(p.moderator),
    badge(p.status), p.board_id ? esc('Board ' + p.board_id + ' (' + p.board_date + ')') : '-',
    `<a class="btn small" href="#paper/${p.paper_id}">Open</a>`
  ]);
}
const PAPER_HEAD = ['Course', 'Paper', 'Exam Date', 'Lecturer', 'Moderator', 'Status', 'Board', ''];

async function viewDashboard() {
  const papers = await api('/papers');
  const counts = {};
  papers.forEach((p) => { counts[p.status] = (counts[p.status] || 0) + 1; });
  let html = `<h2>Welcome, ${esc(ME.full_name || ME.username)}</h2>
    <p class="muted">Total exam papers: <b>${papers.length}</b></p>
    <div class="grid">${STATUSES.map((s) =>
      `<a class="stat" href="#papers/${encodeURIComponent(s)}">${badge(s)}<b>${counts[s] || 0}</b></a>`).join('')}</div>`;
  const wanted = ATTENTION[ROLE] || [];
  const mine = papers.filter((p) => wanted.includes(p.status));
  html += card('Papers needing action', table(PAPER_HEAD, paperRows(mine)));
  if (['admin', 'hod', 'staff'].includes(ROLE)) {
    const boards = (await api('/boards')).filter((b) => b.board_date >= new Date().toISOString().slice(0, 10)).slice(0, 5);
    html += card('Upcoming Scrutiny Boards', table(['Board', 'Board Date', 'Submission Deadline', 'Papers', ''],
      boards.map((b) => [esc(b.board_name || 'Board ' + b.board_id), fmt(b.board_date), fmt(b.submission_deadline),
        fmt(b.papers_assigned), `<a class="btn small" href="#board/${b.board_id}">Open</a>`])));
  }
  $('#view').innerHTML = html;
}

/* ------------------------------------------------------------------ */
/*  Exam papers list                                                   */
/* ------------------------------------------------------------------ */
async function viewPapers(filter) {
  const canCreate = ['admin', 'hod', 'staff'].includes(ROLE);
  let tt = [], lec = [], mod = [];
  if (canCreate) { tt = await api('/timetable'); lec = await api('/lecturers'); mod = await api('/moderators'); }
  const rows = await api('/papers' + (filter ? '?status=' + encodeURIComponent(filter) : ''));

  let html = '<h2>Exam Papers</h2>';
  if (canCreate) {
    html += card('Add exam paper',
      `<div class="form-grid">
        <div><label>Timetable entry *</label><select id="np_tt"><option value="">-- select --</option>${
          tt.map((t) => opt(t.timetable_id, `${t.course_code} - ${t.course_name} (${t.exam_date})`)).join('')}</select></div>
        <div><label>Paper title *</label><input id="np_title" placeholder="e.g. DBMS End Semester Paper"></div>
        <div><label>Lecturer in charge *</label><select id="np_lec"><option value="">-- select --</option>${
          lec.map((l) => opt(l.lecturer_id, l.name)).join('')}</select></div>
        <div><label>Moderator</label><select id="np_mod"><option value="">-- assign later --</option>${
          mod.map((m) => opt(m.moderator_id, m.name)).join('')}</select></div>
       </div><p><button class="btn primary" id="np_save">Add paper</button></p>`);
  }
  html += `<div class="toolbar"><label style="margin:0">Filter by status:</label>
    <select id="statusFilter"><option value="">All</option>${STATUSES.map((s) => opt(s, s, s === filter)).join('')}</select></div>`;
  html += card('', table(PAPER_HEAD, paperRows(rows)));
  $('#view').innerHTML = html;

  $('#statusFilter').addEventListener('change', (e) => {
    location.hash = e.target.value ? '#papers/' + encodeURIComponent(e.target.value) : '#papers';
  });
  on('np_save', async () => {
    if (!val('np_tt') || !val('np_title') || !val('np_lec')) throw new Error('Timetable entry, title and lecturer are required');
    await api('/papers', 'POST', {
      timetable_id: val('np_tt'), paper_title: val('np_title'), lecturer_id: val('np_lec'), moderator_id: val('np_mod')
    });
  });
}

/* ------------------------------------------------------------------ */
/*  One paper: details + workflow actions                              */
/* ------------------------------------------------------------------ */
const STATUS_HELP = {
  'Pending Moderation': 'The lecturer must mark the Examination Paper and Marking Scheme as Available, then send the paper for moderation. A moderator must be assigned.',
  'Under Moderation': 'Waiting for the moderator to review the paper.',
  'Revision Required': 'The lecturer must revise the paper and resubmit it for another moderation cycle.',
  'Moderation Completed': 'The Head of Department must verify the moderation and the required documents.',
  'Ready for Scrutiny': 'The Head of Department can now assign this paper to a Scrutiny Board.',
  'Under Scrutiny': 'The Scrutiny Board reviews the paper and a decision is recorded.',
  'Approved': 'Final status: approved by the Scrutiny Board.',
  'Rejected': 'Final status: rejected by the Scrutiny Board.'
};

async function viewPaper(id) {
  const d = await api('/papers/' + id);
  const p = d.paper;
  const last = d.cycles[d.cycles.length - 1];
  const canSubmit = ['admin', 'hod', 'staff', 'lecturer'].includes(ROLE);
  const isHod = ['admin', 'hod'].includes(ROLE);
  const curReview = d.reviews.find((r) => r.board_id === p.board_id);

  let html = `<p><a href="#papers">&larr; Back to papers</a></p>
    <h2>${esc(p.paper_title)} ${badge(p.status)}</h2>
    <div class="help">${esc(STATUS_HELP[p.status] || '')}</div>`;

  html += card('Paper details', `<div class="info-grid">
    <div><span>Course</span>${esc(p.course_code)} - ${esc(p.course_name)}</div>
    <div><span>Examination</span>${esc(p.exam_name)} (${esc(p.academic_year)}, ${esc(p.semester)})</div>
    <div><span>Exam date &amp; time</span>${fmt(p.exam_date)} ${fmt(p.start_time)} - ${fmt(p.end_time)}</div>
    <div><span>Lecturer in charge</span>${esc(p.lecturer)}</div>
    <div><span>Moderator</span>${fmt(p.moderator)}</div>
    <div><span>Scrutiny Board</span>${p.board_id ? esc((p.board_date || '') + ' (deadline ' + (p.submission_deadline || '-') + ')') : '-'}</div>
    <div><span>Moderation cycles</span>${esc(p.cycles)}</div>
    <div><span>Revisions</span>${esc(p.revisions)}</div>
  </div>`);

  // ---------- Next action ----------
  let action = '';
  if (p.status === 'Pending Moderation' && canSubmit) {
    action = `<p>Make sure the Examination Paper and Marking Scheme are marked <b>Available</b> (table below), then:</p>
      <button class="btn primary" id="a_submit">Send for moderation</button>`;
  }
  if (p.status === 'Under Moderation' && last && last.status === 'Pending Review' && ['admin', 'hod', 'moderator'].includes(ROLE)) {
    action = `<p>Moderation cycle ${last.cycle_no} - record the moderator's review:</p>
      <label>Result *</label><select id="m_status">${opt('Completed', 'Completed (no more corrections)')}${opt('Corrections Required', 'Corrections Required')}</select>
      <label>Comments</label><textarea id="m_comments" placeholder="Language, clarity, question depth, workload..."></textarea>
      <label>Recommendations</label><textarea id="m_reco"></textarea>
      <label>Required corrections (needed if "Corrections Required")</label><textarea id="m_corr"></textarea>
      <p><button class="btn primary" id="a_review">Save moderation result</button></p>`;
  }
  if (p.status === 'Revision Required' && canSubmit) {
    action = `<label>What was revised? *</label><textarea id="r_details"></textarea>
      <p><button class="btn primary" id="a_resubmit">Resubmit for moderation</button></p>`;
  }
  if (p.status === 'Moderation Completed' && isHod) {
    const hods = ROLE === 'admin' ? await api('/hods') : [];
    action = `<p>The system checks that moderation is completed and that the Examination Paper, Marking Scheme and Moderator Report are all available.</p>
      ${ROLE === 'admin' ? `<label>Verifying HOD *</label><select id="v_hod"><option value="">-- select --</option>${hods.map((h) => opt(h.hod_id, h.name)).join('')}</select>` : ''}
      <label>Remarks</label><textarea id="v_remarks"></textarea>
      <p><button class="btn primary" id="a_verify">Verify - ready for scrutiny</button></p>`;
  }
  const reviewPending = curReview && !curReview.decision_id;
  if (isHod && (p.status === 'Ready for Scrutiny' || (p.status === 'Under Scrutiny' && !reviewPending))) {
    const boards = await api('/boards');
    action += `<label>Assign to Scrutiny Board</label>
      <select id="b_board"><option value="">-- select --</option>${boards.map((b) =>
        opt(b.board_id, `${b.board_name || 'Board ' + b.board_id} - ${b.board_date} (deadline ${b.submission_deadline})`, b.board_id === p.board_id)).join('')}</select>
      <p><button class="btn primary" id="a_board">Assign board</button></p>`;
  }
  if (isHod && p.status === 'Under Scrutiny' && !curReview) {
    action += `<hr><p><b>Record the Scrutiny Board review</b></p>
      <label>Observations</label><textarea id="s_obs"></textarea>
      <label>Comments</label><textarea id="s_com"></textarea>
      <p><button class="btn primary" id="a_sreview">Save review</button></p>`;
  }
  if (isHod && p.status === 'Under Scrutiny' && reviewPending) {
    action += `<hr><p><b>Record the Scrutiny Decision</b></p>
      <label>Decision *</label><select id="d_type">${opt('Approved', 'Approved')}${opt('Corrections Required', 'Corrections Required')}${opt('Rejected', 'Rejected')}</select>
      <label>Remarks</label><textarea id="d_remarks"></textarea>
      <p><button class="btn primary" id="a_decision">Save decision</button></p>`;
  }
  html += card('Next step', action || '<p class="muted">Nothing for you to do at this stage.</p>');

  // ---------- Documents ----------
  const allowedDoc = (t) => ['admin', 'hod', 'staff'].includes(ROLE) ||
    (ROLE === 'lecturer' && t !== 'Moderator Report') || (ROLE === 'moderator' && t === 'Moderator Report');
  html += card('Required documents', table(['Document', 'Status', 'Date', 'Link', ''],
    d.documents.map((x) => [
      esc(x.document_type), badge(x.availability_status), fmt(x.submission_date),
      x.file_url ? `<a href="${esc(x.file_url)}" target="_blank" rel="noopener">Open</a>` : '-',
      allowedDoc(x.document_type)
        ? (x.availability_status === 'Available'
          ? `<button class="btn small" data-doc="${x.document_id}" data-to="Missing">Mark Missing</button>`
          : `<button class="btn small primary" data-doc="${x.document_id}" data-to="Available">Mark Available</button>`)
        : ''
    ])));

  // ---------- History sections ----------
  html += card('Moderation cycles', table(['Cycle', 'Submitted', 'Reviewed', 'Status', 'Comments', 'Recommendations', 'Required corrections'],
    d.cycles.map((c) => [c.cycle_no, fmt(c.submission_date), fmt(c.review_date), badge(c.status),
      fmt(c.comments), fmt(c.recommendations), fmt(c.required_corrections)])));
  html += card('Revisions / resubmissions', table(['Revision', 'Submitted', 'Moderation cycle', 'Details', 'Status'],
    d.revisions.map((r) => [r.revision_no, fmt(r.submission_date),
      fmt((d.cycles.find((c) => c.cycle_id === r.cycle_id) || {}).cycle_no), fmt(r.revision_details), badge(r.status)])));
  html += card('HOD verification', table(['Date', 'HOD', 'Moderation complete', 'Documents complete', 'Result', 'Remarks'],
    d.verifications.map((v) => [fmt(v.verified_date), esc(v.hod_name), fmt(v.moderation_complete),
      fmt(v.documents_complete), badge(v.result), fmt(v.remarks)])));
  html += card('Scrutiny reviews & decisions', table(['Board', 'Review date', 'Observations', 'Comments', 'Decision', 'Decision date', 'Remarks'],
    d.reviews.map((r) => [esc(r.board_name || 'Board ' + r.board_id) + ' (' + fmt(r.board_date) + ')', fmt(r.review_date),
      fmt(r.observations), fmt(r.comments), r.decision_type ? badge(r.decision_type) : badge('Pending'),
      fmt(r.decision_date), fmt(r.decision_remarks)])));
  html += card('Status history', table(['When', 'From', 'To'],
    d.history.map((h) => [fmt(h.changed_at), h.old_status ? badge(h.old_status) : '-', badge(h.new_status)])));

  $('#view').innerHTML = html;

  // ---------- Wire buttons ----------
  on('a_submit', () => api(`/papers/${id}/submit-moderation`, 'POST'));
  on('a_review', () => api(`/cycles/${last.cycle_id}`, 'PUT', {
    status: val('m_status'), comments: val('m_comments'), recommendations: val('m_reco'), required_corrections: val('m_corr')
  }));
  on('a_resubmit', () => api(`/papers/${id}/resubmit`, 'POST', { revision_details: val('r_details') }));
  on('a_verify', () => api(`/papers/${id}/verify`, 'POST', { hod_id: val('v_hod'), remarks: val('v_remarks') }));
  on('a_board', async () => {
    if (!val('b_board')) throw new Error('Select a board');
    await api(`/papers/${id}/board`, 'PUT', { board_id: val('b_board') });
  });
  on('a_sreview', () => api(`/papers/${id}/review`, 'POST', { observations: val('s_obs'), comments: val('s_com') }));
  on('a_decision', () => api(`/reviews/${curReview.review_id}/decision`, 'POST', {
    decision_type: val('d_type'), remarks: val('d_remarks')
  }));
  document.querySelectorAll('[data-doc]').forEach((b) => b.addEventListener('click', () => {
    let url = null;
    if (b.dataset.to === 'Available') {
      url = prompt('Link to the file (Google Drive etc.) - optional, you may leave it empty:', '');
      if (url === null) return;
    }
    act(() => api('/documents/' + b.dataset.doc, 'PUT', { availability_status: b.dataset.to, file_url: url || null }));
  }));
}

/* ------------------------------------------------------------------ */
/*  Board page                                                         */
/* ------------------------------------------------------------------ */
async function viewBoard(id) {
  const boards = await api('/boards');
  const b = boards.find((x) => x.board_id === id);
  if (!b) throw new Error('Board not found');
  const papers = await api('/papers?board_id=' + id);
  $('#view').innerHTML = `<p><a href="#boards">&larr; Back to boards</a></p>
    <h2>${esc(b.board_name || 'Board ' + b.board_id)}</h2>` +
    card('Board details', `<div class="info-grid">
      <div><span>Board date</span>${fmt(b.board_date)}</div>
      <div><span>Submission deadline</span>${fmt(b.submission_deadline)}</div>
      <div><span>Papers assigned</span>${fmt(b.papers_assigned)}</div>
      <div><span>Approved</span>${fmt(b.approved)}</div>
      <div><span>Rejected</span>${fmt(b.rejected)}</div>
      <div><span>Corrections required</span>${fmt(b.corrections_required)}</div>
      <div><span>Waiting for decision</span>${fmt(b.pending_decision)}</div></div>`) +
    card('Papers in this board', table(PAPER_HEAD, paperRows(papers)));
}

/* ------------------------------------------------------------------ */
/*  Reports                                                            */
/* ------------------------------------------------------------------ */
const REPORTS = [
  ['papers', 'Paper status overview'], ['status', 'Status summary'], ['moderation', 'Moderation progress'],
  ['missing-documents', 'Missing documents'], ['boards', 'Scrutiny boards summary'],
  ['decisions', 'Scrutiny decisions'], ['history', 'Status history']
];
if (ROLE === 'admin') REPORTS.push(['audit', 'Audit log']);

function toCsv(rows) {
  const keys = Object.keys(rows[0]);
  const q = (v) => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
  return [keys.join(',')].concat(rows.map((r) => keys.map((k) => q(r[k])).join(','))).join('\n');
}

async function viewReports(name) {
  let html = '<h2>Reports</h2><div class="toolbar no-print">' + REPORTS.map((r) =>
    `<a class="btn small${r[0] === name ? ' primary' : ''}" href="#reports/${r[0]}">${esc(r[1])}</a>`).join('') + '</div>';
  if (!name) { $('#view').innerHTML = html + '<p class="muted">Choose a report above.</p>'; return; }
  const rows = await api('/reports/' + name);
  const title = (REPORTS.find((r) => r[0] === name) || [0, name])[1];
  html += `<div class="card"><h3>${esc(title)} <span class="muted">(${rows.length} rows)</span></h3>
    <p class="no-print"><button class="btn small" id="printBtn">Print / Save as PDF</button>
       <button class="btn small" id="csvBtn">Download CSV</button></p>`;
  if (!rows.length) html += '<p class="muted">No records.</p>';
  else {
    const keys = Object.keys(rows[0]);
    html += table(keys.map((k) => k.replace(/_/g, ' ')),
      rows.map((r) => keys.map((k) => (/status$/.test(k) || k === 'decision_type' || k === 'result') ? badge(r[k]) : fmt(r[k]))));
  }
  $('#view').innerHTML = html + '</div>';
  $('#printBtn').addEventListener('click', () => window.print());
  $('#csvBtn').addEventListener('click', () => {
    if (!rows.length) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv' }));
    a.download = name + '-report.csv';
    a.click();
  });
}

/* ------------------------------------------------------------------ */
/*  Users (admin)                                                      */
/* ------------------------------------------------------------------ */
async function viewUsers() {
  const users = await api('/auth/users');
  const roles = ['admin', 'hod', 'lecturer', 'moderator', 'staff'];
  $('#view').innerHTML = '<h2>Users</h2>' +
    card('Create user', `<div class="form-grid">
      <div><label>Username *</label><input id="u_name"></div>
      <div><label>Full name</label><input id="u_full"></div>
      <div><label>Password * (min 6 characters)</label><input id="u_pass" type="password"></div>
      <div><label>Role *</label><select id="u_role">${roles.map((r) => opt(r, r)).join('')}</select></div>
    </div><p><button class="btn primary" id="u_save">Create user</button></p>
    <p class="muted">After creating a lecturer / moderator / HOD login, link it on the Lecturers, Moderators or Heads of Dept. page.</p>`) +
    card('', table(['ID', 'Username', 'Full name', 'Role', ''], users.map((u) => [
      u.user_id, esc(u.username), fmt(u.full_name), esc(u.role),
      `<button class="btn small" data-pw="${u.user_id}">Reset password</button>
       <button class="btn small danger" data-udel="${u.user_id}">Delete</button>`])));
  on('u_save', async () => {
    if (!val('u_name') || !val('u_pass')) throw new Error('Username and password are required');
    await api('/auth/register', 'POST', { username: val('u_name'), full_name: val('u_full'), password: val('u_pass'), role: val('u_role') });
  });
  document.querySelectorAll('[data-pw]').forEach((b) => b.addEventListener('click', () => {
    const pw = prompt('New password (min 6 characters):');
    if (pw) act(() => api('/auth/users/' + b.dataset.pw, 'PUT', { password: pw }), 'Password changed');
  }));
  document.querySelectorAll('[data-udel]').forEach((b) => b.addEventListener('click', () => {
    if (confirm('Delete this user?')) act(() => api('/auth/users/' + b.dataset.udel, 'DELETE'), 'Deleted');
  }));
}

/* ------------------------------------------------------------------ */
/*  Router                                                             */
/* ------------------------------------------------------------------ */
async function route() {
  const parts = (location.hash || '#dashboard').slice(1).split('/');
  const page = parts[0] || 'dashboard';
  const arg = decodeURIComponent(parts[1] || '');
  const menuId = page === 'paper' ? 'papers' : page === 'board' ? 'boards' : page;
  document.querySelectorAll('#sidebar a').forEach((a) => a.classList.toggle('active', a.dataset.id === menuId));
  $('#sidebar').classList.remove('open');
  const item = MENU.find((m) => m.id === menuId);
  if (item && item.roles && !item.roles.includes(ROLE)) {
    $('#view').innerHTML = '<div class="card err">Your role is not allowed to open this page.</div>';
    return;
  }
  $('#view').innerHTML = '<p class="muted">Loading...</p>';
  try {
    if (ENTITIES[page]) await viewEntity(page);
    else if (page === 'papers') await viewPapers(arg);
    else if (page === 'paper') await viewPaper(parseInt(arg));
    else if (page === 'board') await viewBoard(parseInt(arg));
    else if (page === 'reports') await viewReports(arg);
    else if (page === 'users') await viewUsers();
    else await viewDashboard();
  } catch (e) {
    $('#view').innerHTML = `<div class="card err">${esc(e.message)}</div>`;
  }
}

buildMenu();
$('#logout').addEventListener('click', () => { Auth.clear(); location.href = 'index.html'; });
$('#menuToggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
window.addEventListener('hashchange', route);
route();
