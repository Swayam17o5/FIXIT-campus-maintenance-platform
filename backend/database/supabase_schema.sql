-- ==============================================================================
-- FIXIT: Campus Maintenance & Issue Resolution Platform
-- Supabase PostgreSQL Schema (Phase 1: Core Operations, SLA, RBAC & Lifecycle)
-- ==============================================================================

-- 1. MASTER TABLES
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS category (
    category_id   SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL UNIQUE,
    description   TEXT
);

CREATE TABLE IF NOT EXISTS department (
    department_id SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL UNIQUE,
    description   TEXT,
    sla_default_hours INT DEFAULT 24
);

CREATE TABLE IF NOT EXISTS student (
    student_id    SERIAL PRIMARY KEY,
    name          VARCHAR(150) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    phone         VARCHAR(20),
    department    VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff (
    staff_id      SERIAL PRIMARY KEY,
    name          VARCHAR(150) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    phone         VARCHAR(20),
    department    VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20) DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
    created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. CORE COMPLAINT / ISSUE TABLE WITH LIFECYCLE & LOCATION & SLA
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS complaint (
    complaint_id         SERIAL PRIMARY KEY,
    title                VARCHAR(200) NOT NULL,
    description          TEXT NOT NULL,
    status               VARCHAR(30) DEFAULT 'REPORTED' CHECK (status IN (
        'REPORTED', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 
        'RESOLVED', 'VERIFIED', 'CLOSED', 'REJECTED',
        -- Backward-compatible aliases
        'pending', 'open', 'in_progress', 'resolved', 'closed', 'rejected'
    )),
    priority             VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    
    -- Location information (Phase 1)
    building             VARCHAR(100),
    floor                VARCHAR(50),
    room                 VARCHAR(50),
    location_description TEXT,

    -- Lifecycle & Resolution notes (Phase 1)
    rejection_reason     TEXT,
    resolution_notes     TEXT,

    -- SLA tracking (Phase 1)
    sla_hours            INT DEFAULT 24,
    sla_due_date         TIMESTAMPTZ,

    -- Timestamps
    date_filed           TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    assigned_at          TIMESTAMPTZ,
    date_resolved        TIMESTAMPTZ,
    verified_at          TIMESTAMPTZ,
    closed_at            TIMESTAMPTZ,

    -- Foreign keys
    student_id           INT NOT NULL REFERENCES student(student_id) ON DELETE CASCADE,
    category_id          INT NOT NULL REFERENCES category(category_id),
    staff_id             INT REFERENCES staff(staff_id) ON DELETE SET NULL,
    department           VARCHAR(100)
);

-- Ensure columns exist if table was already created
ALTER TABLE complaint ADD COLUMN IF NOT EXISTS building VARCHAR(100);
ALTER TABLE complaint ADD COLUMN IF NOT EXISTS floor VARCHAR(50);
ALTER TABLE complaint ADD COLUMN IF NOT EXISTS room VARCHAR(50);
ALTER TABLE complaint ADD COLUMN IF NOT EXISTS location_description TEXT;
ALTER TABLE complaint ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE complaint ADD COLUMN IF NOT EXISTS resolution_notes TEXT;
ALTER TABLE complaint ADD COLUMN IF NOT EXISTS sla_hours INT DEFAULT 24;
ALTER TABLE complaint ADD COLUMN IF NOT EXISTS sla_due_date TIMESTAMPTZ;
ALTER TABLE complaint ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
ALTER TABLE complaint ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE complaint ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE complaint ADD COLUMN IF NOT EXISTS department VARCHAR(100);

-- Update status check constraint if table was previously created with legacy constraint
ALTER TABLE complaint DROP CONSTRAINT IF EXISTS complaint_status_check;
ALTER TABLE complaint ADD CONSTRAINT complaint_status_check CHECK (status IN (
    'REPORTED', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 
    'RESOLVED', 'VERIFIED', 'CLOSED', 'REJECTED',
    'pending', 'open', 'in_progress', 'resolved', 'closed', 'rejected'
));

-- 3. ASSIGNMENT HISTORY (Phase 1)
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS assignment_history (
    assignment_id SERIAL PRIMARY KEY,
    complaint_id  INT NOT NULL REFERENCES complaint(complaint_id) ON DELETE CASCADE,
    staff_id      INT REFERENCES staff(staff_id) ON DELETE SET NULL,
    assigned_by   INT,
    department    VARCHAR(100),
    notes         TEXT,
    assigned_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. RESPONSES & FEEDBACK
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS response (
    response_id     SERIAL PRIMARY KEY,
    message         TEXT NOT NULL,
    date_responded  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    complaint_id    INT NOT NULL REFERENCES complaint(complaint_id) ON DELETE CASCADE,
    staff_id        INT REFERENCES staff(staff_id)
);

CREATE TABLE IF NOT EXISTS feedback (
    feedback_id   SERIAL PRIMARY KEY,
    message       TEXT,
    rating        INT CHECK (rating BETWEEN 1 AND 5),
    date          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    complaint_id  INT NOT NULL UNIQUE REFERENCES complaint(complaint_id) ON DELETE CASCADE,
    student_id    INT NOT NULL REFERENCES student(student_id)
);

CREATE TABLE IF NOT EXISTS complaint_audit (
    audit_id       SERIAL PRIMARY KEY,
    complaint_id   INT,
    old_status     VARCHAR(50),
    new_status     VARCHAR(50),
    changed_by     VARCHAR(100),
    changed_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. MASTER SEED DATA
-- ------------------------------------------------------------------------------

INSERT INTO category (name, description) VALUES
('Academic Facilities', 'Classrooms, lecture halls, smart boards, and laboratory equipment issues'),
('Electrical & Power', 'Lighting, wiring, sockets, power cuts, and backup power generators'),
('Plumbing & Water', 'Restrooms, water purifiers, leakage, taps, and water supply issues'),
('IT & Network Infrastructure', 'Wi-Fi connectivity, server access, lab workstations, and campus portal problems'),
('Hostel & Residential', 'Room furniture, locks, common room amenities, and hostel maintenance'),
('HVAC & Ventilation', 'Air conditioning, fans, heating, and ventilation systems'),
('Civil & Carpentry', 'Doors, windows, desks, masonry, painting, and structural repairs'),
('Sanitation & Housekeeping', 'Cleanliness, garbage disposal, pest control, and hygiene concerns'),
('Campus Security & Safety', 'CCTV, gate access, fire safety, and emergency lighting issues')
ON CONFLICT (name) DO UPDATE
    SET description = EXCLUDED.description;

INSERT INTO department (name, description, sla_default_hours) VALUES
('Maintenance', 'General campus upkeep and facility repair', 24),
('Electrical Engineering', 'Power, wiring, generators, and electronics', 12),
('Plumbing & Sanitation', 'Water supply, plumbing fittings, and drainage', 12),
('IT Infrastructure', 'Networking, computers, smart boards, and servers', 6),
('Civil & Infrastructure', 'Building structures, carpentry, and masonry', 48),
('Hostel Administration', 'Hostel accommodation, mess, and amenities', 24),
('Campus Security', 'Gate control, surveillance, and emergency safety', 2)
ON CONFLICT (name) DO UPDATE
    SET description = EXCLUDED.description;

-- 6. INDEXES
-- ------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_complaint_student ON complaint(student_id);
CREATE INDEX IF NOT EXISTS idx_complaint_staff ON complaint(staff_id);
CREATE INDEX IF NOT EXISTS idx_complaint_category ON complaint(category_id);
CREATE INDEX IF NOT EXISTS idx_complaint_status ON complaint(status);
CREATE INDEX IF NOT EXISTS idx_complaint_priority ON complaint(priority);
CREATE INDEX IF NOT EXISTS idx_complaint_building ON complaint(building);
CREATE INDEX IF NOT EXISTS idx_complaint_sla_due ON complaint(sla_due_date);
CREATE INDEX IF NOT EXISTS idx_assignment_complaint ON assignment_history(complaint_id);
CREATE INDEX IF NOT EXISTS idx_response_complaint ON response(complaint_id);
CREATE INDEX IF NOT EXISTS idx_feedback_complaint ON feedback(complaint_id);

-- 7. OPERATIONS DASHBOARD & ANALYTICS VIEWS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE VIEW vw_open_complaints AS
SELECT
    c.complaint_id,
    c.title,
    c.status,
    c.priority,
    c.building,
    c.floor,
    c.room,
    c.date_filed,
    c.sla_hours,
    c.sla_due_date,
    s.name AS student_name,
    s.department AS student_dept,
    cat.name AS category,
    COALESCE(st.name, 'Unassigned') AS assigned_to,
    c.department AS assigned_department
FROM complaint c
JOIN student s ON c.student_id = s.student_id
JOIN category cat ON c.category_id = cat.category_id
LEFT JOIN staff st ON c.staff_id = st.staff_id
WHERE UPPER(c.status) NOT IN ('RESOLVED', 'VERIFIED', 'CLOSED', 'REJECTED');

CREATE OR REPLACE VIEW vw_student_complaint_history AS
SELECT
    s.student_id,
    s.name AS student_name,
    s.department,
    c.complaint_id,
    c.title,
    c.status,
    c.priority,
    c.building,
    c.room,
    cat.name AS category,
    c.date_filed,
    c.date_resolved,
    c.sla_due_date,
    COALESCE(f.rating::text, 'No Feedback') AS feedback_rating
FROM student s
JOIN complaint c ON s.student_id = c.student_id
JOIN category cat ON c.category_id = cat.category_id
LEFT JOIN feedback f ON c.complaint_id = f.complaint_id;

CREATE OR REPLACE VIEW vw_staff_workload AS
SELECT
    st.staff_id,
    st.name AS staff_name,
    st.department,
    COUNT(c.complaint_id) AS total_assigned,
    COUNT(c.complaint_id) FILTER (WHERE UPPER(c.status) IN ('RESOLVED', 'VERIFIED', 'CLOSED')) AS resolved,
    COUNT(c.complaint_id) FILTER (WHERE UPPER(c.status) IN ('ASSIGNED', 'IN_PROGRESS', 'UNDER_REVIEW', 'REPORTED', 'OPEN', 'PENDING')) AS pending_open,
    ROUND(COALESCE(AVG(f.rating), 0)::numeric, 2) AS avg_feedback_rating
FROM staff st
LEFT JOIN complaint c ON st.staff_id = c.staff_id
LEFT JOIN feedback f ON c.complaint_id = f.complaint_id
GROUP BY st.staff_id, st.name, st.department;

CREATE OR REPLACE VIEW vw_category_stats AS
SELECT
    cat.name AS category,
    COUNT(c.complaint_id) AS total,
    COUNT(c.complaint_id) FILTER (WHERE UPPER(c.status) IN ('RESOLVED', 'VERIFIED', 'CLOSED')) AS resolved,
    COUNT(c.complaint_id) FILTER (WHERE UPPER(c.status) IN ('REPORTED', 'UNDER_REVIEW', 'PENDING')) AS pending,
    COUNT(c.complaint_id) FILTER (WHERE UPPER(c.status) IN ('IN_PROGRESS', 'ASSIGNED', 'OPEN')) AS in_progress,
    ROUND(
        COALESCE(
            COUNT(c.complaint_id) FILTER (WHERE UPPER(c.status) IN ('RESOLVED', 'VERIFIED', 'CLOSED')) * 100.0 / NULLIF(COUNT(c.complaint_id), 0),
            0
        )::numeric,
        1
    ) AS resolution_rate_pct
FROM category cat
LEFT JOIN complaint c ON cat.category_id = c.category_id
GROUP BY cat.category_id, cat.name;

CREATE OR REPLACE VIEW vw_complaints_by_status AS
SELECT 
    CASE 
        WHEN UPPER(status) IN ('PENDING', 'REPORTED') THEN 'REPORTED'
        WHEN UPPER(status) IN ('OPEN', 'UNDER_REVIEW') THEN 'UNDER_REVIEW'
        WHEN UPPER(status) = 'ASSIGNED' THEN 'ASSIGNED'
        WHEN UPPER(status) = 'IN_PROGRESS' THEN 'IN_PROGRESS'
        WHEN UPPER(status) = 'RESOLVED' THEN 'RESOLVED'
        WHEN UPPER(status) = 'VERIFIED' THEN 'VERIFIED'
        WHEN UPPER(status) = 'CLOSED' THEN 'CLOSED'
        WHEN UPPER(status) = 'REJECTED' THEN 'REJECTED'
        ELSE UPPER(status)
    END AS status,
    COUNT(*) AS total_complaints
FROM complaint
GROUP BY 1
ORDER BY total_complaints DESC;

CREATE OR REPLACE VIEW vw_complaints_by_category AS
SELECT cat.name AS category, COUNT(c.complaint_id) AS total
FROM category cat
LEFT JOIN complaint c ON cat.category_id = c.category_id
GROUP BY cat.category_id, cat.name
ORDER BY total DESC;

CREATE OR REPLACE VIEW vw_complaints_by_department AS
SELECT 
    COALESCE(c.department, s.department, 'General') AS department,
    COUNT(c.complaint_id) AS complaints_raised
FROM complaint c
LEFT JOIN student s ON c.student_id = s.student_id
GROUP BY 1
ORDER BY complaints_raised DESC;

CREATE OR REPLACE VIEW vw_staff_performance AS
SELECT st.name AS staff_name, st.department, COUNT(c.complaint_id) AS resolved_count
FROM staff st
JOIN complaint c ON st.staff_id = c.staff_id
WHERE UPPER(c.status) IN ('RESOLVED', 'VERIFIED', 'CLOSED')
GROUP BY st.staff_id, st.name, st.department
ORDER BY resolved_count DESC;

CREATE OR REPLACE VIEW vw_average_resolution_time AS
SELECT
    COALESCE(
        ROUND(
            AVG(
                EXTRACT(EPOCH FROM (date_resolved - date_filed)) / 3600.0
            )::numeric,
            1
        ),
        0
    ) AS avg_hours_to_resolve,
    COALESCE(
        ROUND(
            AVG(
                EXTRACT(EPOCH FROM (date_resolved - date_filed)) / 86400.0
            )::numeric,
            1
        ),
        0
    ) AS avg_days_to_resolve
FROM complaint
WHERE date_resolved IS NOT NULL;

CREATE OR REPLACE VIEW vw_location_stats AS
SELECT 
    COALESCE(building, 'Unspecified Building') AS building,
    COUNT(complaint_id) AS total_issues,
    COUNT(complaint_id) FILTER (WHERE UPPER(status) NOT IN ('RESOLVED', 'VERIFIED', 'CLOSED', 'REJECTED')) AS active_issues,
    COUNT(complaint_id) FILTER (WHERE UPPER(status) IN ('RESOLVED', 'VERIFIED', 'CLOSED')) AS resolved_issues
FROM complaint
GROUP BY COALESCE(building, 'Unspecified Building')
ORDER BY total_issues DESC;

-- 8. TRIGGERS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fn_set_resolved_date()
RETURNS TRIGGER AS $$
BEGIN
    IF UPPER(NEW.status) IN ('RESOLVED', 'VERIFIED', 'CLOSED') AND 
       (OLD.status IS NULL OR UPPER(OLD.status) NOT IN ('RESOLVED', 'VERIFIED', 'CLOSED')) THEN
        NEW.date_resolved := NOW();
    END IF;

    IF UPPER(NEW.status) = 'VERIFIED' AND (OLD.status IS NULL OR UPPER(OLD.status) != 'VERIFIED') THEN
        NEW.verified_at := NOW();
    END IF;

    IF UPPER(NEW.status) = 'CLOSED' AND (OLD.status IS NULL OR UPPER(OLD.status) != 'CLOSED') THEN
        NEW.closed_at := NOW();
    END IF;

    IF UPPER(NEW.status) NOT IN ('RESOLVED', 'VERIFIED', 'CLOSED') AND UPPER(OLD.status) IN ('RESOLVED', 'VERIFIED', 'CLOSED') THEN
        NEW.date_resolved := NULL;
        NEW.verified_at := NULL;
        NEW.closed_at := NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_resolved_date ON complaint;
CREATE TRIGGER trg_set_resolved_date
BEFORE UPDATE ON complaint
FOR EACH ROW
EXECUTE FUNCTION fn_set_resolved_date();

CREATE OR REPLACE FUNCTION fn_audit_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO complaint_audit (complaint_id, old_status, new_status, changed_at)
        VALUES (NEW.complaint_id, OLD.status, NEW.status, NOW());
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_status_change ON complaint;
CREATE TRIGGER trg_audit_status_change
AFTER UPDATE ON complaint
FOR EACH ROW
EXECUTE FUNCTION fn_audit_status_change();

-- 9. PERMISSIONS
-- ------------------------------------------------------------------------------
ALTER TABLE IF EXISTS department DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS assignment_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS category DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS student DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS staff DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS complaint DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS response DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS feedback DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS complaint_audit DISABLE ROW LEVEL SECURITY;
