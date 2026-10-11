-- =====================================================================
-- Scrutiny Board Management System  (v2 - matches Project Proposal)
-- Exam PAPER scrutiny: timetable -> moderation -> revisions ->
-- documents -> HOD verification -> scrutiny board -> decision
-- Run in Supabase SQL Editor.  The existing `users` + `audit_log`
-- tables (and your admin login) are KEPT. Everything else is replaced.
-- =====================================================================

-- ---------- 1. Remove the old (student-results) design ----------------
DROP TABLE IF EXISTS appeals CASCADE;
DROP TABLE IF EXISTS decisions CASCADE;
DROP TABLE IF EXISTS student_cases CASCADE;
DROP TABLE IF EXISTS meetings CASCADE;
DROP TABLE IF EXISTS board_membership CASCADE;
DROP TABLE IF EXISTS board_members CASCADE;
DROP TABLE IF EXISTS exam_results CASCADE;
DROP TABLE IF EXISTS modules CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS faculties CASCADE;
DROP TABLE IF EXISTS scrutiny_boards CASCADE;
DROP FUNCTION IF EXISTS log_decision_change() CASCADE;

-- Drop v2 tables too, so this script can be re-run safely
DROP TABLE IF EXISTS paper_status_history CASCADE;
DROP TABLE IF EXISTS scrutiny_decisions CASCADE;
DROP TABLE IF EXISTS scrutiny_reviews CASCADE;
DROP TABLE IF EXISTS hod_verifications CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS revisions CASCADE;
DROP TABLE IF EXISTS moderation_cycles CASCADE;
DROP TABLE IF EXISTS marking_schemes CASCADE;
DROP TABLE IF EXISTS exam_papers CASCADE;
DROP TABLE IF EXISTS exam_timetable CASCADE;
DROP TABLE IF EXISTS examinations CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS moderators CASCADE;
DROP TABLE IF EXISTS lecturers CASCADE;
DROP TABLE IF EXISTS hods CASCADE;

-- ---------- 2. Users / roles (keep table, change allowed roles) -------
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
UPDATE users SET role = 'hod'       WHERE role = 'chair';
UPDATE users SET role = 'moderator' WHERE role = 'board_member';
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('admin','hod','lecturer','moderator','staff'));

-- ---------- 3. People ----------------------------------------------------
CREATE TABLE hods (
    hod_id      SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(100),
    department  VARCHAR(100)
);

CREATE TABLE lecturers (
    lecturer_id SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(100) UNIQUE,
    contact_no  VARCHAR(20)
);

CREATE TABLE moderators (
    moderator_id SERIAL PRIMARY KEY,
    user_id      INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    name         VARCHAR(100) NOT NULL,
    email        VARCHAR(100) UNIQUE,
    contact_no   VARCHAR(20),
    department   VARCHAR(100)
);

-- ---------- 4. Examination, courses, timetable (3.1, 3.2) -----------------
CREATE TABLE examinations (
    exam_id       SERIAL PRIMARY KEY,
    academic_year VARCHAR(9)   NOT NULL,           -- e.g. 2025/2026
    semester      VARCHAR(20)  NOT NULL,
    exam_name     VARCHAR(100) NOT NULL,
    exam_type     VARCHAR(30)  NOT NULL
                  CHECK (exam_type IN ('End Semester','Mid Semester','Repeat','Supplementary'))
);

CREATE TABLE courses (
    course_code VARCHAR(15)  PRIMARY KEY,
    course_name VARCHAR(100) NOT NULL
);

CREATE TABLE exam_timetable (
    timetable_id SERIAL PRIMARY KEY,
    exam_id      INTEGER     NOT NULL REFERENCES examinations(exam_id) ON DELETE CASCADE,
    course_code  VARCHAR(15) NOT NULL REFERENCES courses(course_code)  ON DELETE RESTRICT,
    exam_date    DATE        NOT NULL,
    start_time   TIME        NOT NULL,
    end_time     TIME        NOT NULL,
    CHECK (end_time > start_time),
    UNIQUE (exam_id, course_code)
);

-- ---------- 5. Scrutiny boards (3.10) -------------------------------------
CREATE TABLE scrutiny_boards (
    board_id            SERIAL PRIMARY KEY,
    board_name          VARCHAR(100),
    board_date          DATE NOT NULL,
    submission_deadline DATE NOT NULL,
    CHECK (submission_deadline <= board_date)
);

-- ---------- 6. Exam papers (3.2, 3.3, 3.5, 3.13) --------------------------
CREATE TABLE exam_papers (
    paper_id        SERIAL PRIMARY KEY,
    timetable_id    INTEGER NOT NULL UNIQUE                 -- one paper per timetable entry
                    REFERENCES exam_timetable(timetable_id) ON DELETE CASCADE,
    paper_title     VARCHAR(150) NOT NULL,
    submission_date DATE,
    status          VARCHAR(30) NOT NULL DEFAULT 'Pending Moderation'
                    CHECK (status IN ('Pending Moderation','Under Moderation','Revision Required',
                                      'Moderation Completed','Ready for Scrutiny',
                                      'Under Scrutiny','Approved','Rejected')),
    lecturer_id     INTEGER NOT NULL REFERENCES lecturers(lecturer_id) ON DELETE RESTRICT,
    moderator_id    INTEGER REFERENCES moderators(moderator_id) ON DELETE RESTRICT,
    board_id        INTEGER REFERENCES scrutiny_boards(board_id) ON DELETE SET NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ---------- 7. Marking scheme (3.4) ---------------------------------------
CREATE TABLE marking_schemes (
    scheme_id         SERIAL PRIMARY KEY,
    paper_id          INTEGER NOT NULL UNIQUE REFERENCES exam_papers(paper_id) ON DELETE CASCADE,
    submission_date   DATE,
    submission_status VARCHAR(20) NOT NULL DEFAULT 'Not Submitted'
                      CHECK (submission_status IN ('Not Submitted','Submitted'))
);

-- ---------- 8. Moderation cycles & revisions (3.6, 3.7) -------------------
CREATE TABLE moderation_cycles (
    cycle_id            SERIAL PRIMARY KEY,
    paper_id            INTEGER NOT NULL REFERENCES exam_papers(paper_id) ON DELETE CASCADE,
    cycle_no            INTEGER NOT NULL CHECK (cycle_no > 0),
    submission_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    review_date         DATE,
    status              VARCHAR(25) NOT NULL DEFAULT 'Pending Review'
                        CHECK (status IN ('Pending Review','Corrections Required','Completed')),
    comments            TEXT,
    recommendations     TEXT,
    required_corrections TEXT,
    UNIQUE (paper_id, cycle_no),
    CHECK (review_date IS NULL OR review_date >= submission_date)
);

CREATE TABLE revisions (
    revision_id      SERIAL PRIMARY KEY,
    paper_id         INTEGER NOT NULL REFERENCES exam_papers(paper_id)       ON DELETE CASCADE,
    cycle_id         INTEGER NOT NULL REFERENCES moderation_cycles(cycle_id) ON DELETE CASCADE,
    revision_no      INTEGER NOT NULL CHECK (revision_no > 0),
    submission_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    revision_details TEXT,
    status           VARCHAR(20) NOT NULL DEFAULT 'Submitted'
                     CHECK (status IN ('Submitted','Accepted','Rejected')),
    UNIQUE (paper_id, revision_no)
);

-- ---------- 9. Documents (3.8) ---------------------------------------------
CREATE TABLE documents (
    document_id         SERIAL PRIMARY KEY,
    paper_id            INTEGER NOT NULL REFERENCES exam_papers(paper_id) ON DELETE CASCADE,
    cycle_id            INTEGER REFERENCES moderation_cycles(cycle_id) ON DELETE SET NULL,
    document_type       VARCHAR(30) NOT NULL
                        CHECK (document_type IN ('Examination Paper','Marking Scheme','Moderator Report')),
    submission_date     DATE,
    availability_status VARCHAR(20) NOT NULL DEFAULT 'Missing'
                        CHECK (availability_status IN ('Missing','Available')),
    file_url            TEXT          -- optional link (Google Drive / Supabase Storage)
);

-- ---------- 10. HOD verification (3.9) -------------------------------------
CREATE TABLE hod_verifications (
    verification_id     SERIAL PRIMARY KEY,
    paper_id            INTEGER NOT NULL REFERENCES exam_papers(paper_id) ON DELETE CASCADE,
    hod_id              INTEGER NOT NULL REFERENCES hods(hod_id) ON DELETE RESTRICT,
    verified_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    moderation_complete BOOLEAN NOT NULL DEFAULT FALSE,   -- set automatically by trigger
    documents_complete  BOOLEAN NOT NULL DEFAULT FALSE,   -- set automatically by trigger
    result              VARCHAR(20) NOT NULL DEFAULT 'Verified'
                        CHECK (result IN ('Verified','Not Verified')),
    remarks             TEXT
);

-- ---------- 11. Scrutiny review & decision (3.11, 3.12) --------------------
CREATE TABLE scrutiny_reviews (
    review_id     SERIAL PRIMARY KEY,
    board_id      INTEGER NOT NULL REFERENCES scrutiny_boards(board_id) ON DELETE CASCADE,
    paper_id      INTEGER NOT NULL REFERENCES exam_papers(paper_id)     ON DELETE CASCADE,
    review_date   DATE NOT NULL DEFAULT CURRENT_DATE,
    observations  TEXT,
    comments      TEXT,
    review_status VARCHAR(20) NOT NULL DEFAULT 'In Progress'
                  CHECK (review_status IN ('In Progress','Completed')),
    UNIQUE (board_id, paper_id)
);

CREATE TABLE scrutiny_decisions (
    decision_id   SERIAL PRIMARY KEY,
    review_id     INTEGER NOT NULL UNIQUE REFERENCES scrutiny_reviews(review_id) ON DELETE CASCADE,
    decision_date DATE NOT NULL DEFAULT CURRENT_DATE,
    decision_type VARCHAR(25) NOT NULL
                  CHECK (decision_type IN ('Approved','Corrections Required','Rejected')),
    remarks       TEXT
);

-- ---------- 12. Status history (3.13) --------------------------------------
CREATE TABLE paper_status_history (
    history_id SERIAL PRIMARY KEY,
    paper_id   INTEGER NOT NULL REFERENCES exam_papers(paper_id) ON DELETE CASCADE,
    old_status VARCHAR(30),
    new_status VARCHAR(30) NOT NULL,
    changed_at TIMESTAMP DEFAULT NOW()
);

-- ---------- 13. Indexes -----------------------------------------------------
CREATE INDEX idx_papers_status    ON exam_papers(status);
CREATE INDEX idx_papers_board     ON exam_papers(board_id);
CREATE INDEX idx_papers_lecturer  ON exam_papers(lecturer_id);
CREATE INDEX idx_papers_moderator ON exam_papers(moderator_id);
CREATE INDEX idx_cycles_paper     ON moderation_cycles(paper_id);
CREATE INDEX idx_docs_paper       ON documents(paper_id, document_type);
CREATE INDEX idx_timetable_date   ON exam_timetable(exam_date);
CREATE INDEX idx_reviews_board    ON scrutiny_reviews(board_id);

-- =====================================================================
-- BUSINESS-RULE TRIGGERS
-- =====================================================================

-- Helper: is a paper eligible for scrutiny?
--  * latest moderation cycle is Completed
--  * Examination Paper, Marking Scheme, Moderator Report are all Available
CREATE OR REPLACE FUNCTION paper_moderation_done(p_paper INTEGER) RETURNS BOOLEAN AS $$
    SELECT COALESCE((
        SELECT status = 'Completed'
        FROM moderation_cycles
        WHERE paper_id = p_paper
        ORDER BY cycle_no DESC LIMIT 1
    ), FALSE);
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION paper_documents_done(p_paper INTEGER) RETURNS BOOLEAN AS $$
    SELECT (SELECT COUNT(DISTINCT document_type)
            FROM documents
            WHERE paper_id = p_paper AND availability_status = 'Available') = 3;
$$ LANGUAGE sql STABLE;

-- T1: log every status change of a paper
CREATE OR REPLACE FUNCTION trg_paper_status_log() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO paper_status_history(paper_id, old_status, new_status)
        VALUES (NEW.paper_id, NULL, NEW.status);
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        INSERT INTO paper_status_history(paper_id, old_status, new_status)
        VALUES (NEW.paper_id, OLD.status, NEW.status);
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER paper_status_log
AFTER INSERT OR UPDATE ON exam_papers
FOR EACH ROW EXECUTE FUNCTION trg_paper_status_log();

-- T2: a paper can join a board only after HOD verification (status Ready for Scrutiny)
CREATE OR REPLACE FUNCTION trg_paper_board_rule() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.board_id IS NOT NULL AND NEW.board_id IS DISTINCT FROM OLD.board_id THEN
        IF OLD.status NOT IN ('Ready for Scrutiny','Under Scrutiny') THEN
            RAISE EXCEPTION 'This paper cannot be assigned to a board yet: its status is "%", it must be "Ready for Scrutiny" (HOD verification first).',
                OLD.status;
        END IF;
        IF OLD.status = 'Ready for Scrutiny' THEN
            NEW.status := 'Under Scrutiny';
        END IF;
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER paper_board_rule
BEFORE UPDATE OF board_id ON exam_papers
FOR EACH ROW EXECUTE FUNCTION trg_paper_board_rule();

-- T3: moderation cycle rules + automatic paper status
CREATE OR REPLACE FUNCTION trg_cycle_rules() RETURNS TRIGGER AS $$
DECLARE v_mod INTEGER;
BEGIN
    IF TG_OP = 'INSERT' THEN
        SELECT moderator_id INTO v_mod FROM exam_papers WHERE paper_id = NEW.paper_id;
        IF v_mod IS NULL THEN
            RAISE EXCEPTION 'Assign a moderator to this paper before starting moderation.';
        END IF;
        UPDATE exam_papers SET status = 'Under Moderation' WHERE paper_id = NEW.paper_id;
    ELSE
        IF NEW.status = 'Corrections Required' THEN
            UPDATE exam_papers SET status = 'Revision Required' WHERE paper_id = NEW.paper_id;
        ELSIF NEW.status = 'Completed' THEN
            UPDATE exam_papers SET status = 'Moderation Completed' WHERE paper_id = NEW.paper_id;
        END IF;
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER cycle_rules
AFTER INSERT OR UPDATE OF status ON moderation_cycles
FOR EACH ROW EXECUTE FUNCTION trg_cycle_rules();

-- T4: HOD verification computes the two flags and enforces eligibility
CREATE OR REPLACE FUNCTION trg_hod_verify() RETURNS TRIGGER AS $$
BEGIN
    NEW.moderation_complete := paper_moderation_done(NEW.paper_id);
    NEW.documents_complete  := paper_documents_done(NEW.paper_id);
    IF NEW.result = 'Verified' AND NOT (NEW.moderation_complete AND NEW.documents_complete) THEN
        RAISE EXCEPTION 'Cannot verify this paper. Latest moderation cycle completed: %. Examination Paper + Marking Scheme + Moderator Report all available: %.',
            CASE WHEN NEW.moderation_complete THEN 'yes' ELSE 'NO' END,
            CASE WHEN NEW.documents_complete  THEN 'yes' ELSE 'NO' END;
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER hod_verify_rule
BEFORE INSERT ON hod_verifications
FOR EACH ROW EXECUTE FUNCTION trg_hod_verify();

CREATE OR REPLACE FUNCTION trg_hod_verified_status() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.result = 'Verified' THEN
        UPDATE exam_papers SET status = 'Ready for Scrutiny' WHERE paper_id = NEW.paper_id;
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER hod_verified_status
AFTER INSERT ON hod_verifications
FOR EACH ROW EXECUTE FUNCTION trg_hod_verified_status();

-- T5: a review requires that the paper really belongs to that board
CREATE OR REPLACE FUNCTION trg_review_rule() RETURNS TRIGGER AS $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM exam_papers
                   WHERE paper_id = NEW.paper_id AND board_id = NEW.board_id) THEN
        RAISE EXCEPTION 'This paper is not assigned to the selected board.';
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER review_rule
BEFORE INSERT ON scrutiny_reviews
FOR EACH ROW EXECUTE FUNCTION trg_review_rule();

-- T6: decision updates the final paper status
CREATE OR REPLACE FUNCTION trg_decision_status() RETURNS TRIGGER AS $$
DECLARE v_paper INTEGER;
BEGIN
    SELECT paper_id INTO v_paper FROM scrutiny_reviews WHERE review_id = NEW.review_id;
    UPDATE scrutiny_reviews SET review_status = 'Completed' WHERE review_id = NEW.review_id;
    UPDATE exam_papers SET status = CASE NEW.decision_type
            WHEN 'Approved'             THEN 'Approved'
            WHEN 'Rejected'             THEN 'Rejected'
            WHEN 'Corrections Required' THEN 'Revision Required'
        END
    WHERE paper_id = v_paper;
    INSERT INTO audit_log(action, table_name, record_id)
    VALUES ('Scrutiny decision: ' || NEW.decision_type, 'scrutiny_decisions', NEW.decision_id);
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER decision_status
AFTER INSERT ON scrutiny_decisions
FOR EACH ROW EXECUTE FUNCTION trg_decision_status();

-- =====================================================================
-- REPORT VIEWS  (Reporting & Monitoring, scope section 6)
-- =====================================================================

CREATE OR REPLACE VIEW v_paper_overview AS
SELECT p.paper_id, p.paper_title, p.status,
       c.course_code, c.course_name,
       e.exam_name, e.academic_year, e.semester,
       t.exam_date, t.start_time, t.end_time,
       l.name AS lecturer, m.name AS moderator,
       b.board_id, b.board_date, b.submission_deadline,
       (SELECT COUNT(*) FROM moderation_cycles mc WHERE mc.paper_id = p.paper_id) AS cycles,
       (SELECT COUNT(*) FROM revisions r WHERE r.paper_id = p.paper_id)           AS revisions,
       paper_documents_done(p.paper_id) AS documents_complete
FROM exam_papers p
JOIN exam_timetable t ON t.timetable_id = p.timetable_id
JOIN examinations   e ON e.exam_id = t.exam_id
JOIN courses        c ON c.course_code = t.course_code
JOIN lecturers      l ON l.lecturer_id = p.lecturer_id
LEFT JOIN moderators m ON m.moderator_id = p.moderator_id
LEFT JOIN scrutiny_boards b ON b.board_id = p.board_id;

CREATE OR REPLACE VIEW v_moderation_progress AS
SELECT p.paper_id, p.paper_title, p.status, m.name AS moderator,
       COUNT(mc.cycle_id) AS total_cycles,
       MAX(mc.review_date) AS last_review_date,
       (SELECT status FROM moderation_cycles x
         WHERE x.paper_id = p.paper_id ORDER BY cycle_no DESC LIMIT 1) AS latest_cycle_status
FROM exam_papers p
LEFT JOIN moderators m ON m.moderator_id = p.moderator_id
LEFT JOIN moderation_cycles mc ON mc.paper_id = p.paper_id
GROUP BY p.paper_id, p.paper_title, p.status, m.name;

CREATE OR REPLACE VIEW v_board_summary AS
SELECT b.board_id, b.board_name, b.board_date, b.submission_deadline,
       COUNT(p.paper_id) AS papers_assigned,
       COUNT(*) FILTER (WHERE p.status = 'Approved') AS approved,
       COUNT(*) FILTER (WHERE p.status = 'Rejected') AS rejected,
       COUNT(*) FILTER (WHERE p.status = 'Revision Required') AS corrections_required,
       COUNT(*) FILTER (WHERE p.status = 'Under Scrutiny') AS pending_decision
FROM scrutiny_boards b
LEFT JOIN exam_papers p ON p.board_id = b.board_id
GROUP BY b.board_id, b.board_name, b.board_date, b.submission_deadline;

CREATE OR REPLACE VIEW v_missing_documents AS
SELECT p.paper_id, p.paper_title, d.doc_type AS missing_document
FROM exam_papers p
CROSS JOIN (VALUES ('Examination Paper'),('Marking Scheme'),('Moderator Report')) AS d(doc_type)
WHERE NOT EXISTS (SELECT 1 FROM documents x
                  WHERE x.paper_id = p.paper_id
                    AND x.document_type = d.doc_type
                    AND x.availability_status = 'Available');

CREATE OR REPLACE VIEW v_status_summary AS
SELECT status, COUNT(*) AS papers FROM exam_papers GROUP BY status;

-- =====================================================================
-- SAMPLE DATA (optional - delete if not needed)
-- =====================================================================
INSERT INTO courses VALUES ('ICT1212','Database Management Systems'),
                           ('ICT1223','Computer Networks');
INSERT INTO hods(name,email,department)   VALUES ('Dr. HOD Sample','hod@uni.lk','ICT');
INSERT INTO lecturers(name,email,contact_no) VALUES ('Mr. Lecturer One','lec1@uni.lk','0711111111');
INSERT INTO moderators(name,email,contact_no,department) VALUES ('Dr. Moderator One','mod1@uni.lk','0722222222','ICT');
INSERT INTO examinations(academic_year,semester,exam_name,exam_type)
       VALUES ('2025/2026','Semester 1','End Semester Exam 2026','End Semester');
INSERT INTO exam_timetable(exam_id,course_code,exam_date,start_time,end_time)
       VALUES (1,'ICT1212','2026-12-10','09:00','12:00'),(1,'ICT1223','2026-12-12','09:00','11:00');
INSERT INTO scrutiny_boards(board_name,board_date,submission_deadline)
       VALUES ('Board 1','2026-11-25','2026-11-20');
INSERT INTO exam_papers(timetable_id,paper_title,lecturer_id,moderator_id)
       VALUES (1,'DBMS End Semester Paper',1,1),(2,'Networks End Semester Paper',1,1);
