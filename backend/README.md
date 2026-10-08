# Campus Complaint Management Backend

Express + MySQL backend for the Campus Complaint Management System.

## Tech Stack

- Node.js + Express
- MySQL (raw SQL queries via `mysql2`)
- JWT-based student auth
- No ORM used

## Folder Structure

```text
backend/
  database/
    schema.sql
  src/
    app.js
    server.js
    config/
      db.js
      env.js
    controllers/
      categories.controller.js
      complaints.controller.js
      feedback.controller.js
      reports.controller.js
      responses.controller.js
      staff.controller.js
      students.controller.js
    middleware/
      auth.js
      errorHandler.js
    routes/
      categories.routes.js
      complaints.routes.js
      feedback.routes.js
      index.js
      reports.routes.js
      responses.routes.js
      staff.routes.js
      students.routes.js
    utils/
      asyncHandler.js
  .env.example
  docker-compose.yml
  index.js
  package.json
```

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Start MySQL container:

```bash
docker compose up -d
```

3. Create `.env` from `.env.example`.

4. Run schema (DDL + views + triggers, no dummy inserts):

```bash
mysql -h 127.0.0.1 -P 3306 -u root -pexample < database/schema.sql
```

5. Start backend:

```bash
pnpm start
```

Base URL: `http://localhost:4000/api`

## Auth

- Student protected routes require header:

`Authorization: Bearer <token>`

## API Routes

### Health

- `GET /api/health`
  - Params: none
  - Query: none
  - Body: none

### Categories

- `GET /api/categories`
  - Params: none
  - Query: none
  - Body: none

- `GET /api/categories/:id`
  - Params: `id` (category id)
  - Query: none
  - Body: none

- `POST /api/categories`
  - Params: none
  - Query: none
  - Body:

```json
{
  "name": "Infrastructure",
  "description": "Infrastructure related complaints"
}
```

- `PATCH /api/categories/:id`
  - Params: `id`
  - Query: none
  - Body (any one or both):

```json
{
  "name": "Academic",
  "description": "Updated description"
}
```

- `DELETE /api/categories/:id`
  - Params: `id`
  - Query: none
  - Body: none

### Students / Auth

- `POST /api/students/register`
  - Params: none
  - Query: none
  - Body:

```json
{
  "name": "Arjun Reddy",
  "email": "arjun.reddy@student.edu",
  "phone": "9876543210",
  "department": "Computer Science",
  "password": "pass1234"
}
```

- `POST /api/students/login`
  - Params: none
  - Query: none
  - Body:

```json
{
  "email": "arjun.reddy@student.edu",
  "password": "pass1234"
}
```

- `GET /api/students/:id` (protected)
  - Params: `id` (student id)
  - Query: none
  - Body: none

- `PATCH /api/students/:id` (protected)
  - Params: `id`
  - Query: none
  - Body (at least one):

```json
{
  "name": "New Name",
  "phone": "9999999999",
  "department": "Electronics"
}
```

- `GET /api/students/:id/complaints` (protected)
  - Params: `id`
  - Query: none
  - Body: none

### Staff

- `GET /api/staff`
  - Params: none
  - Query: none
  - Body: none

- `POST /api/staff`
  - Params: none
  - Query: none
  - Body:

```json
{
  "name": "Ms. Anitha Das",
  "email": "anitha.das@college.edu",
  "phone": "9000055555",
  "department": "Academic",
  "role": "staff"
}
```

- `GET /api/staff/:id`
  - Params: `id`
  - Query: none
  - Body: none

- `PATCH /api/staff/:id`
  - Params: `id`
  - Query: none
  - Body (at least one):

```json
{
  "name": "Updated Name",
  "email": "updated@college.edu",
  "phone": "9000000000",
  "department": "Infrastructure",
  "role": "admin"
}
```

- `DELETE /api/staff/:id`
  - Params: `id`
  - Query: none
  - Body: none

- `GET /api/staff/:id/complaints`
  - Params: `id`
  - Query: none
  - Body: none

### Complaints

- `GET /api/complaints`
  - Params: none
  - Query (all optional):
    - `status`: `pending | open | in_progress | resolved | closed | rejected`
    - `priority`: `low | medium | high | critical`
    - `student_id`: number
    - `staff_id`: number or `unassigned`
    - `category_id`: number
    - `q`: text search over title/description
    - `page`: number (default `1`)
    - `limit`: number (default `20`, max `100`)
  - Body: none

- `POST /api/complaints`
  - Params: none
  - Query: none
  - Body:

```json
{
  "title": "Projector not working",
  "description": "Projector in CS-301 is not working",
  "student_id": 1,
  "category_id": 2,
  "priority": "high",
  "staff_id": null
}
```

- `GET /api/complaints/:id`
  - Params: `id`
  - Query: none
  - Body: none

- `PATCH /api/complaints/:id`
  - Params: `id`
  - Query: none
  - Body (at least one):

```json
{
  "title": "Updated title",
  "description": "Updated description",
  "status": "in_progress",
  "priority": "critical",
  "category_id": 1,
  "staff_id": 2
}
```

- `PATCH /api/complaints/:id/assign`
  - Params: `id`
  - Query: none
  - Body:

```json
{
  "staff_id": 2
}
```

- `DELETE /api/complaints/:id`
  - Params: `id`
  - Query: none
  - Body: none

### Responses

- `POST /api/responses`
  - Params: none
  - Query: none
  - Body:

```json
{
  "complaint_id": 1,
  "staff_id": 2,
  "message": "Technician has been assigned."
}
```

- `GET /api/responses/complaint/:complaintId`
  - Params: `complaintId`
  - Query: none
  - Body: none

### Feedback

- `POST /api/feedback`
  - Params: none
  - Query: none
  - Body:

```json
{
  "complaint_id": 1,
  "student_id": 1,
  "rating": 5,
  "message": "Issue resolved quickly"
}
```

- `GET /api/feedback/complaint/:complaintId`
  - Params: `complaintId`
  - Query: none
  - Body: none

### Reports

- `GET /api/reports/complaints-by-status`
  - Params: none
  - Query: none
  - Body: none

- `GET /api/reports/complaints-by-category`
  - Params: none
  - Query: none
  - Body: none

- `GET /api/reports/complaints-by-department`
  - Params: none
  - Query: none
  - Body: none

- `GET /api/reports/staff-performance`
  - Params: none
  - Query: none
  - Body: none

- `GET /api/reports/average-resolution-time`
  - Params: none
  - Query: none
  - Body: none

- `GET /api/reports/open-complaints-dashboard`
  - Params: none
  - Query: none
  - Body: none
