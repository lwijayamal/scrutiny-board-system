-- =====================================================
-- Scrutiny Board Management System - PostgreSQL Schema
-- Run this in Supabase SQL Editor (or psql)
-- =====================================================

-- Clean slate (careful: drops existing tables with same names)
DROP TABLE IF EXISTS audit_log CASCADE;
DROP TABLE IF EXISTS appeals CASCADE;
DROP TABLE IF EXISTS decisions CASCADE;
DROP TABLE IF EXISTS student_cases CASCADE;
DROP TABLE IF EXISTS meetings CASCADE;
DROP TABLE IF EXISTS board_membership CASCADE;
DROP TABLE IF EXISTS board_members CASCADE;
DROP TABLE IF EXISTS scrutiny_boards CASCADE;
DROP TABLE IF EXISTS exam_results CASCADE;
DROP TABLE IF EXISTS modules CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS faculties CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ---------------------------------------------------
-- Reference tables
-- ---------------------------------------------------
CREATE TABLE faculties (
    faculty_id      SERIAL PRIMARY KEY,
    faculty_name    VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE students (
    student_id      SERIAL PRIMARY KEY,
    reg_no          VARCHAR(20) NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    faculty_id      INTEGER NOT NULL REFERENCES faculties(faculty_id) ON DELETE RESTRICT,
    batch           VARCHAR(20),
    email           VARCHAR(100),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE modules (
    module_id       SERIAL PRIMARY KEY,
    module_name     VARCHAR(100) NOT NULL,
    credits         SMALLINT NOT NULL CHECK (credits > 0),
    faculty_id      INTEGER NOT NULL REFERENCES faculties(faculty_id) ON DELETE RESTRICT
);

CREATE TABLE exam_results (
    result_id       SERIAL PRIMARY KEY,
    student_id      INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    module_id       INTEGER NOT NULL REFERENCES modules(module_id) ON DELETE RESTRICT,
    semester        VARCHAR(20) NOT NULL,
    marks           DECIMAL(5,2) CHECK (marks BETWEEN 0 AND 100),
    grade           VARCHAR(3),
    UNIQUE (student_id, module_id, semester)
);

-- ---------------------------------------------------
-- Users / Authentication
-- ---------------------------------------------------
CREATE TABLE users (
    user_id         SERIAL PRIMARY KEY,
    username        VARCHAR(50) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL CHECK (role IN ('admin','chair','board_member','staff')),
    full_name       VARCHAR(100),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ---------------------------------------------------
-- Scrutiny Board core
-- ---------------------------------------------------
CREATE TABLE scrutiny_boards (
    board_id        SERIAL PRIMARY KEY,
    faculty_id      INTEGER NOT NULL REFERENCES faculties(faculty_id) ON DELETE RESTRICT,
    academic_year   VARCHAR(9) NOT NULL,
    semester        VARCHAR(20) NOT NULL
);

CREATE TABLE board_members (
    member_id       SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    name            VARCHAR(100) NOT NULL,
    staff_id        VARCHAR(20),
    designation     VARCHAR(50)
);

CREATE TABLE board_membership (
    board_id        INTEGER NOT NULL REFERENCES scrutiny_boards(board_id) ON DELETE CASCADE,
    member_id       INTEGER NOT NULL REFERENCES board_members(member_id) ON DELETE CASCADE,
    role_in_board   VARCHAR(30) NOT NULL DEFAULT 'Member',
    PRIMARY KEY (board_id, member_id)
);

CREATE TABLE meetings (
    meeting_id      SERIAL PRIMARY KEY,
    board_id        INTEGER NOT NULL REFERENCES scrutiny_boards(board_id) ON DELETE CASCADE,
    meeting_date    DATE NOT NULL,
    venue           VARCHAR(100),
    status          VARCHAR(20) NOT NULL DEFAULT 'Scheduled'
                        CHECK (status IN ('Scheduled','Held','Cancelled'))
);

CREATE TABLE student_cases (
    case_id         SERIAL PRIMARY KEY,
    meeting_id      INTEGER NOT NULL REFERENCES meetings(meeting_id) ON DELETE CASCADE,
    student_id      INTEGER NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    case_type       VARCHAR(20) NOT NULL DEFAULT 'Normal'
                        CHECK (case_type IN ('Normal','Medical','Appeal','Disciplinary')),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE decisions (
    decision_id     SERIAL PRIMARY KEY,
    case_id         INTEGER NOT NULL REFERENCES student_cases(case_id) ON DELETE CASCADE,
    decision_type   VARCHAR(30) NOT NULL
                        CHECK (decision_type IN ('Pass','Repeat','MedicalExemption','Referred','Excluded','DisciplinaryAction')),
    remarks         TEXT,
    decision_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    is_current      BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE appeals (
    appeal_id       SERIAL PRIMARY KEY,
    case_id         INTEGER NOT NULL REFERENCES student_cases(case_id) ON DELETE CASCADE,
    reason          TEXT NOT NULL,
    appeal_status   VARCHAR(20) NOT NULL DEFAULT 'Pending'
                        CHECK (appeal_status IN ('Pending','Approved','Rejected')),
    submitted_date  DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE TABLE audit_log (
    log_id          SERIAL PRIMARY KEY,
    user_id         INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    action          VARCHAR(200) NOT NULL,
    table_name      VARCHAR(50),
    record_id       INTEGER,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ---------------------------------------------------
-- Indexes (Physical Design)
-- ---------------------------------------------------
CREATE INDEX idx_cases_student   ON student_cases(student_id);
CREATE INDEX idx_cases_meeting   ON student_cases(meeting_id);
CREATE INDEX idx_meetings_board  ON meetings(board_id, meeting_date);
CREATE INDEX idx_results_student ON exam_results(student_id, semester);
CREATE INDEX idx_decisions_case  ON decisions(case_id);

-- ---------------------------------------------------
-- Trigger: auto audit-log on decision changes
-- ---------------------------------------------------
CREATE OR REPLACE FUNCTION log_decision_change() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_log(action, table_name, record_id)
    VALUES (TG_OP || ' on decisions', 'decisions', COALESCE(NEW.decision_id, OLD.decision_id));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_decision_audit
AFTER INSERT OR UPDATE ON decisions
FOR EACH ROW EXECUTE FUNCTION log_decision_change();

-- ---------------------------------------------------
-- Seed data (sample, optional)
-- ---------------------------------------------------
INSERT INTO faculties (faculty_name) VALUES ('Faculty of Computing'), ('Faculty of Applied Sciences');

INSERT INTO users (username, password_hash, role, full_name)
VALUES ('admin', '$2b$10$replace_with_real_bcrypt_hash', 'admin', 'System Admin');
-- NOTE: generate a real bcrypt hash via the /api/auth/register route or a script; see README.
