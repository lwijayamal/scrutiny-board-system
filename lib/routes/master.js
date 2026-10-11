// Simple master-data tables: examinations, courses, timetable, lecturers, moderators, HODs, boards
const express = require('express');
const crud = require('../crud');

const r = express.Router();
const EDITORS = ['admin', 'hod', 'staff'];

r.use('/examinations', crud({
  table: 'examinations', pk: 'exam_id',
  cols: ['academic_year', 'semester', 'exam_name', 'exam_type'],
  writeRoles: EDITORS, orderBy: 'academic_year DESC, exam_id DESC'
}));

r.use('/courses', crud({
  table: 'courses', pk: 'course_code', manualPk: true,
  cols: ['course_name'], writeRoles: EDITORS
}));

r.use('/timetable', crud({
  table: 'exam_timetable', pk: 'timetable_id',
  cols: ['exam_id', 'course_code', 'exam_date', 'start_time', 'end_time'],
  writeRoles: EDITORS,
  listSql: `SELECT t.*, c.course_name, e.exam_name, e.academic_year
            FROM exam_timetable t
            JOIN courses c ON c.course_code = t.course_code
            JOIN examinations e ON e.exam_id = t.exam_id
            ORDER BY t.exam_date, t.start_time`
}));

r.use('/lecturers', crud({
  table: 'lecturers', pk: 'lecturer_id',
  cols: ['name', 'email', 'contact_no', 'user_id'],
  writeRoles: ['admin', 'hod'],
  listSql: `SELECT l.*, u.username FROM lecturers l
            LEFT JOIN users u ON u.user_id = l.user_id ORDER BY l.name`
}));

r.use('/moderators', crud({
  table: 'moderators', pk: 'moderator_id',
  cols: ['name', 'email', 'contact_no', 'department', 'user_id'],
  writeRoles: ['admin', 'hod'],
  listSql: `SELECT m.*, u.username FROM moderators m
            LEFT JOIN users u ON u.user_id = m.user_id ORDER BY m.name`
}));

r.use('/hods', crud({
  table: 'hods', pk: 'hod_id',
  cols: ['name', 'email', 'department', 'user_id'],
  writeRoles: ['admin'],
  listSql: `SELECT h.*, u.username FROM hods h
            LEFT JOIN users u ON u.user_id = h.user_id ORDER BY h.name`
}));

r.use('/boards', crud({
  table: 'scrutiny_boards', pk: 'board_id',
  cols: ['board_name', 'board_date', 'submission_deadline'],
  writeRoles: ['admin', 'hod'],
  listSql: 'SELECT * FROM v_board_summary ORDER BY board_date, board_id'
}));

module.exports = r;
