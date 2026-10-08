# FIXIT System Architecture & Technical Specifications

> **FIXIT — Campus Maintenance & Issue Resolution Platform**  
> Technical Architecture, State Machines, Data Models, and Security Protocols.

---

## 1. High-Level System Architecture

FIXIT is engineered as a decoupled, multi-tiered architecture with strict boundaries between presentation, business logic orchestration, and relational data persistence.

```mermaid
flowchart TD
    subgraph ClientLayer ["Client Layer (Presentation)"]
        A1["Student Portal (Next.js 16)"]
        A2["Staff Queue (Next.js 16)"]
        A3["Admin Operations (Next.js 16)"]
    end

    subgraph APIGateway ["Transport Layer"]
        B["Axios HTTP Client with Bearer Interceptor"]
        C["RESTful API Gateway (Express.js)"]
    end

    subgraph SecurityLayer ["Security & Authorization Layer"]
        D["JWT Authentication Middleware"]
        E["Role-Based Access Control (RBAC) Guard"]
        F["Ownership Validation Guard"]
    end

    subgraph LogicLayer ["Core Business Logic & Services"]
        G["Lifecycle State Machine"]
        H["Dynamic SLA Engine"]
        I["Audit & Chronological Logger"]
        J["Controllers (Complaints, Reports, Staff, Feedback)"]
    end

    subgraph DataLayer ["Persistence Layer"]
        K["Supabase Client (Data Access Layer)"]
        L[("PostgreSQL Database")]
    end

    A1 & A2 & A3 --> B
    B -->|HTTP / JSON| C
    C --> D
    D --> E
    E --> F
    F --> J
    J <--> G
    J <--> H
    J <--> I
    J --> K
    K --> L
```

---

## 2. Request Flow Architecture

Every incoming transaction passes through security gates before invoking business logic or touching the database:

```mermaid
sequenceDiagram
    autonumber
    actor User as User (Student / Staff / Admin)
    participant Client as Next.js Frontend
    participant Route as Express Router
    participant Auth as Auth & RBAC Middleware
    participant Controller as Domain Controller
    participant Engine as SLA / Lifecycle Engine
    participant DB as Supabase PostgreSQL
    participant Audit as Activity Logger

    User->>Client: Submit Action (e.g. Create Issue / Update Status)
    Client->>Route: HTTP POST/PUT /api/... (Bearer Token in Header)
    Route->>Auth: verifyToken(req)
    alt Invalid / Expired Token
        Auth-->>Client: 401 Unauthorized
    else Valid Token
        Auth->>Auth: requireRole(role) & Ownership Check
        alt Unauthorized Role / Tenant
            Auth-->>Client: 403 Forbidden
        else Authorized
            Auth->>Controller: req.user attached, proceed next()
            Controller->>Engine: Validate Transition & Compute SLA
            alt Invalid State Transition
                Engine-->>Controller: Transition Rejected (400 Bad Request)
                Controller-->>Client: Error: Transition Not Permitted
            else Valid Transition
                Controller->>DB: Execute Query (Parameterized)
                DB-->>Controller: Updated Record
                Controller->>Audit: logActivity(event, actor, details)
                Audit->>DB: Insert into activity_log & complaint_audit
                Controller-->>Client: 200/201 JSON Response
                Client-->>User: Update UI / Toast Notification
            end
        end
    end
```

---

## 3. Canonical Issue Lifecycle State Machine

FIXIT enforces a strict, deterministic finite-state machine (FSM). Status mutations must satisfy allowed directional transitions; arbitrary status jumps are rejected at the API layer.

```mermaid
stateDiagram-v2
    [*] --> REPORTED: Student submits issue
    REPORTED --> UNDER_REVIEW: Admin triages issue
    REPORTED --> REJECTED: Admin rejects issue (with reason)
    UNDER_REVIEW --> REJECTED: Admin rejects issue (with reason)
    UNDER_REVIEW --> ASSIGNED: Admin assigns staff & department
    ASSIGNED --> IN_PROGRESS: Staff accepts & begins work
    IN_PROGRESS --> RESOLVED: Staff completes work (with resolution notes)
    RESOLVED --> VERIFIED: Student confirms resolution
    RESOLVED --> IN_PROGRESS: Student rejects fix (Issue Reopened)
    VERIFIED --> CLOSED: Admin / System closes ticket
    CLOSED --> [*]
    REJECTED --> [*]
```

### Transition Matrix Enforced by Backend (`src/utils/lifecycle.js`):

| Current Status | Allowed Next Statuses | Authorized Actors |
| :--- | :--- | :--- |
| `REPORTED` | `UNDER_REVIEW`, `REJECTED` | `admin` |
| `UNDER_REVIEW` | `ASSIGNED`, `REJECTED` | `admin` |
| `ASSIGNED` | `IN_PROGRESS` | `staff` (assigned), `admin` |
| `IN_PROGRESS` | `RESOLVED` | `staff` (assigned), `admin` |
| `RESOLVED` | `VERIFIED`, `IN_PROGRESS` (reopen) | `student` (owner), `admin` |
| `VERIFIED` | `CLOSED` | `admin`, `system` |
| `REJECTED` | *(Terminal state)* | None |
| `CLOSED` | *(Terminal state)* | None |

---

## 4. Authentication & Role-Based Access Control (RBAC) Flow

```mermaid
flowchart TD
    A["Incoming HTTP Request"] --> B{"Has Authorization Header?"}
    B -- No --> C["401 Unauthorized"]
    B -- Yes --> D["Extract Bearer JWT Token"]
    D --> E{"Verify Signature & Expiration"}
    E -- Invalid / Expired --> F["401 Token Expired or Invalid"]
    E -- Valid --> G["Attach req.user (id, email, role)"]
    G --> H{"Target Route Role Guard"}
    
    H -- Public / Auth --> Z["Execute Controller"]
    H -- Student Only --> I{"req.user.role == 'student'?"}
    H -- Staff Only --> J{"req.user.role == 'staff'?"}
    H -- Admin Only --> K{"req.user.role == 'admin'?"}
    H -- Staff or Admin --> L{"req.user.role in ['staff','admin']?"}

    I -- No --> M["403 Forbidden: Student access required"]
    J -- No --> N["403 Forbidden: Staff access required"]
    K -- No --> O["403 Forbidden: Admin access required"]
    L -- No --> P["403 Forbidden: Operations access required"]

    I -- Yes --> Q{"Accessing Specific Complaint?"}
    Q -- Yes --> R{"Is Student the Ticket Owner?"}
    R -- No --> S["403 Forbidden: Not Ticket Owner"]
    R -- Yes --> Z
    Q -- No --> Z

    J & K & L -- Yes --> Z
```

---

## 5. Dynamic SLA Engine Workflow

The SLA Engine computes resolution targets dynamically relative to submission time (`date_filed`).

```mermaid
flowchart LR
    A["Issue Submission"] --> B["Capture date_filed & priority"]
    B --> C{"Priority Lookup"}
    C -->|Critical| D["sla_hours = 2h"]
    C -->|High| E["sla_hours = 6h"]
    C -->|Medium| F["sla_hours = 24h"]
    C -->|Low| G["sla_hours = 72h"]
    
    D & E & F & G --> H["sla_due_date = date_filed + sla_hours"]
    
    H --> I{"Ticket Status"}
    I -->|RESOLVED / VERIFIED / CLOSED| J["Check resolved_at vs sla_due_date"]
    J -->|resolved_at <= sla_due_date| K["Resolved within SLA"]
    J -->|resolved_at > sla_due_date| L["SLA Breached (Resolved Late)"]

    I -->|Active (REPORTED .. IN_PROGRESS)| M{"Current Time vs sla_due_date"}
    M -->|now <= sla_due_date| N["Remaining Time Countdown & % Progress"]
    M -->|now > sla_due_date| O["SLA Breached Alert"]
```

---

## 6. Database Schema & Entity Relationships

The PostgreSQL relational database is structured to maintain referential integrity with cascading foreign keys and audit preservation.

```mermaid
erDiagram
    student ||--o{ complaint : "submits"
    student ||--o{ feedback : "provides"
    staff ||--o{ complaint : "assigned_to"
    staff ||--o{ response : "writes"
    department ||--o{ staff : "employs"
    department ||--o{ complaint : "categorizes"
    category ||--o{ complaint : "classifies"
    complaint ||--o{ response : "contains"
    complaint ||--o{ feedback : "receives"
    complaint ||--o{ activity_log : "audited_by"
    complaint ||--o{ assignment_history : "tracks"

    student {
        int student_id PK
        varchar name
        varchar email UK
        varchar password_hash
        varchar roll_no UK
        varchar department
        varchar room_no
        timestamp created_at
    }

    staff {
        int staff_id PK
        varchar name
        varchar email UK
        varchar password_hash
        varchar role
        varchar department
        varchar phone
        timestamp created_at
    }

    department {
        int department_id PK
        varchar name UK
        varchar code UK
        text description
        timestamp created_at
    }

    category {
        int category_id PK
        varchar name UK
        text description
    }

    complaint {
        int complaint_id PK
        int student_id FK
        int category_id FK
        int assigned_staff_id FK
        varchar title
        text description
        varchar status
        varchar priority
        varchar building
        varchar floor
        varchar room
        text location_description
        varchar department
        text rejection_reason
        text resolution_notes
        int sla_hours
        timestamptz sla_due_date
        timestamptz assigned_at
        timestamptz verified_at
        timestamptz closed_at
        timestamptz date_filed
    }

    activity_log {
        int log_id PK
        int complaint_id FK
        int actor_id
        varchar actor_type
        varchar actor_name
        varchar event_type
        text message
        jsonb details
        timestamptz created_at
    }

    assignment_history {
        int assignment_id PK
        int complaint_id FK
        int staff_id FK
        varchar department
        int assigned_by
        timestamptz assigned_at
        timestamptz unassigned_at
    }

    response {
        int response_id PK
        int complaint_id FK
        int staff_id FK
        text message
        timestamp response_date
    }

    feedback {
        int feedback_id PK
        int complaint_id FK
        int student_id FK
        int rating
        text comments
        timestamp feedback_date
    }
```

---

## 7. Verified REST API Specifications

All endpoints are hosted at `/api` and return standardized JSON formats.

### Complaints Resource

| Method | Endpoint | Required Role | Request Body / Query Params | Expected Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/complaints` | Authenticated | `?search=&status=&priority=&category=&building=&room=&page=&limit=` | Returns paginated list. Students only receive their own issues; Admin/Staff receive all issues. |
| `POST` | `/api/complaints` | `student` | `{ title, description, category_id, priority, building, floor, room, location_description }` | Creates issue with status `REPORTED`, calculates dynamic SLA, records audit log, returns `201 Created`. |
| `GET` | `/api/complaints/:id` | Authenticated | URL parameter `:id` | Returns issue details, dynamic SLA evaluation, and activity timeline. Blocks non-owner students with `403`. |
| `PUT` | `/api/complaints/:id/status` | Staff or Admin | `{ status, notes, rejection_reason }` | Validates transition through lifecycle state machine. Enforces staff ownership. |
| `PUT` | `/api/complaints/:id/assign` | `admin` | `{ staff_id, department }` | Transitions status from `UNDER_REVIEW` to `ASSIGNED`, updates `assigned_at`, logs event. |
| `POST` | `/api/complaints/:id/verify` | Owner `student` | `{ verified: true/false, notes }` | Transitions `RESOLVED` to `VERIFIED` (if confirmed) or reopens to `IN_PROGRESS` (if rejected). |
| `GET` | `/api/complaints/:id/activity` | Authenticated | URL parameter `:id` | Returns chronological array of all historical actions, comments, and status mutations. |

### Staff Operations Resource

| Method | Endpoint | Required Role | Request Body / Query Params | Expected Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/staff/me/assigned` | `staff` | None (reads token) | Returns tickets assigned to current staff user with dynamic SLA timers and location details. |
| `GET` | `/api/staff/:id/complaints` | Assigned Staff or Admin | URL parameter `:id` | Returns tickets assigned to specified staff member. |

### Analytics & Reporting Resource

| Method | Endpoint | Required Role | Request Body / Query Params | Expected Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/reports/operations-dashboard` | Staff or Admin | None | Computes live operational KPIs, SLA compliance %, breach count, status and location breakdowns. |

---

## 8. Security Design & Threat Mitigation

1. **Defense in Depth**: Access control is enforced at the backend routing level (`backend/src/middleware/auth.js`) independently of frontend UI controls.
2. **Horizontal Privilege Escalation Prevention**: When a student queries an issue by ID (`GET /api/complaints/:id`), the controller validates that `complaint.student_id === req.user.id`. Requests for other students' tickets are rejected with `403 Forbidden`.
3. **Secret Isolation**:
   - `SUPABASE_SERVICE_ROLE_KEY` is exclusively consumed by Node.js backend controllers and never bundled into frontend assets.
   - Frontend communicates exclusively with the Express REST API via public `NEXT_PUBLIC_API_URL`.
4. **Input Sanitization**: Database operations use parameterized queries through the Supabase client SDK, preventing SQL injection vulnerabilities.
