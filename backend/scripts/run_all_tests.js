import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import env from '../src/config/env.js';

const BASE_URL = 'http://localhost:4000/api';

const printHeader = (title) => {
  console.log('\n==================================================');
  console.log(`🧪 ${title}`);
  console.log('==================================================');
};

const assert = (condition, msg) => {
  if (!condition) {
    throw new Error(`Assertion Failed: ${msg}`);
  }
  console.log(`  ✅ Passed: ${msg}`);
};

const runTestSuite = async () => {
  printHeader('STARTING FIXIT END-TO-END VERIFICATION SUITE');

  // Step 0: Generate Tokens
  console.log('\n🔑 Preparing Auth Tokens for Student, Other Student, Staff, and Admin...');

  // Student 1 (Swayam)
  const student1Token = jwt.sign(
    { id: 1, studentId: 1, role: 'student', email: 'swayam.vrij@gmail.com', name: 'Swayam Rangoonwala' },
    env.jwtSecret,
    { expiresIn: '1h' }
  );

  // Student 2 (Unauthorized Student)
  const student2Token = jwt.sign(
    { id: 999, studentId: 999, role: 'student', email: 'intruder@test.edu', name: 'Intruder Student' },
    env.jwtSecret,
    { expiresIn: '1h' }
  );

  // Staff (Staff ID 1)
  const staffToken = jwt.sign(
    { id: 1, staffId: 1, role: 'staff', email: 'staff@campus.edu', name: 'Campus Technician' },
    env.jwtSecret,
    { expiresIn: '1h' }
  );

  // Admin
  const adminToken = jwt.sign(
    { id: 99, staffId: 99, role: 'admin', email: 'admin@campus.edu', name: 'Chief Operations Officer' },
    env.jwtSecret,
    { expiresIn: '1h' }
  );

  console.log('  ✅ Auth tokens ready.');

  // TEST 1: Student creates issue -> REPORTED -> Appears in Admin dashboard
  printHeader('TEST 1: Student Creates Issue -> REPORTED -> Appears in Admin Dashboard');
  const createRes = await fetch(`${BASE_URL}/complaints`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${student1Token}`
    },
    body: JSON.stringify({
      title: 'Lab 402 AC Cooling Inoperative',
      description: 'The server rack room AC has stopped functioning, temperature is rising.',
      category_id: 2,
      priority: 'high',
      building: 'Computer Science Building',
      floor: '4th Floor',
      room: 'Lab 402',
      location_description: 'Adjacent to main server enclosure',
      department: 'Electrical Engineering'
    })
  });

  const createData = await createRes.json();
  assert(createRes.status === 201, `Status code is 201 (Got ${createRes.status})`);
  assert(createData.complaint_id > 0, `Created issue has valid complaint_id #${createData.complaint_id}`);
  assert(createData.status === 'REPORTED', `Lifecycle status is 'REPORTED' (Got ${createData.status})`);
  assert(createData.sla_hours === 6, `High priority dynamic SLA is 6 hours (Got ${createData.sla_hours})`);

  const issueId = createData.complaint_id;

  // Verify it appears in Admin operations dashboard
  const adminDashRes = await fetch(`${BASE_URL}/reports/operations-dashboard`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const adminDashData = await adminDashRes.json();
  assert(adminDashRes.status === 200, 'Admin can view operations dashboard');
  assert(adminDashData.kpis.totalIssues >= 1, 'Total issues count is positive');

  // TEST 2: Admin reviews issue -> Assigns staff -> ASSIGNED
  printHeader('TEST 2: Admin Reviews Issue -> Assigns Staff -> ASSIGNED');
  const assignRes = await fetch(`${BASE_URL}/complaints/${issueId}/assign`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      staff_id: 1,
      department: 'Electrical Engineering',
      notes: 'Please inspect the circuit breaker and AC compressor unit.'
    })
  });
  const assignData = await assignRes.json();
  assert(assignRes.status === 200, 'Admin successfully assigned staff');
  assert(assignData.status === 'ASSIGNED', `Issue status transitioned to ASSIGNED (Got ${assignData.status})`);

  // TEST 3: Staff views assigned issue -> IN_PROGRESS -> Add operational note
  printHeader('TEST 3: Staff Views Assigned Issue -> Moves to IN_PROGRESS -> Adds Operational Note');
  const staffIssuesRes = await fetch(`${BASE_URL}/staff/1/complaints`, {
    headers: { 'Authorization': `Bearer ${staffToken}` }
  });
  const staffIssues = await staffIssuesRes.json();
  assert(staffIssuesRes.status === 200, 'Staff can view their assigned issues');
  const assignedItem = staffIssues.find(i => i.complaint_id === issueId);
  assert(!!assignedItem, `Issue #${issueId} is present in staff's assigned list`);

  // Staff moves to IN_PROGRESS and adds operational note
  const progressRes = await fetch(`${BASE_URL}/complaints/${issueId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${staffToken}`
    },
    body: JSON.stringify({
      status: 'IN_PROGRESS',
      operational_notes: 'Technician on-site. Testing capacitor and thermostat.'
    })
  });
  const progressData = await progressRes.json();
  assert(progressRes.status === 200, 'Staff updated status to IN_PROGRESS');
  assert(progressData.status === 'IN_PROGRESS', `Status is now IN_PROGRESS (Got ${progressData.status})`);

  // TEST 4: Staff resolves issue -> RESOLVED
  printHeader('TEST 4: Staff Resolves Issue -> RESOLVED (with Resolution Notes)');
  const resolveRes = await fetch(`${BASE_URL}/complaints/${issueId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${staffToken}`
    },
    body: JSON.stringify({
      status: 'RESOLVED',
      resolution_notes: 'Replaced faulty contactor relay. Thermostat reset and temperature normalized to 20°C.'
    })
  });
  const resolveData = await resolveRes.json();
  assert(resolveRes.status === 200, 'Staff updated status to RESOLVED');
  assert(resolveData.status === 'RESOLVED', `Status is now RESOLVED (Got ${resolveData.status})`);

  // TEST 5: Student verifies fixed -> VERIFIED
  printHeader('TEST 5: Student Verifies Fixed -> VERIFIED');
  const verifyRes = await fetch(`${BASE_URL}/complaints/${issueId}/verify`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${student1Token}` }
  });
  const verifyData = await verifyRes.json();
  assert(verifyRes.status === 200, 'Student verified the resolution');
  assert(verifyData.status === 'VERIFIED', `Status is now VERIFIED (Got ${verifyData.status})`);

  // TEST 6: System / Admin Closes Issue -> CLOSED
  printHeader('TEST 6: Admin Closes Issue -> CLOSED');
  const closeRes = await fetch(`${BASE_URL}/complaints/${issueId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ status: 'CLOSED' })
  });
  const closeData = await closeRes.json();
  assert(closeRes.status === 200, 'Admin closed the verified issue');
  assert(closeData.status === 'CLOSED', `Status is now CLOSED (Got ${closeData.status})`);

  // TEST 7: Student Reopening Flow: Create another issue, resolve it, then student reopens -> IN_PROGRESS
  printHeader('TEST 7: Student Reopening Flow (RESOLVED -> IN_PROGRESS)');
  const issue2Res = await fetch(`${BASE_URL}/complaints`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${student1Token}`
    },
    body: JSON.stringify({
      title: 'Water tap leaking in Library Restroom',
      description: 'Tap constantly dripping water.',
      category_id: 2,
      priority: 'medium',
      building: 'Central Library',
      room: '1st Floor Restroom'
    })
  });
  const issue2Id = (await issue2Res.json()).complaint_id;

  // Admin assigns & marks resolved
  await fetch(`${BASE_URL}/complaints/${issue2Id}/assign`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
    body: JSON.stringify({ staff_id: 1 })
  });
  await fetch(`${BASE_URL}/complaints/${issue2Id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${staffToken}` },
    body: JSON.stringify({ status: 'RESOLVED', resolution_notes: 'Washer tightened.' })
  });

  // Student reopens issue
  const reopenRes = await fetch(`${BASE_URL}/complaints/${issue2Id}/reopen`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${student1Token}`
    },
    body: JSON.stringify({ reason: 'Water still dripping under pressure when turned on.' })
  });
  const reopenData = await reopenRes.json();
  assert(reopenRes.status === 200, 'Student successfully reopened the issue');
  assert(reopenData.status === 'IN_PROGRESS', `Status transitioned back to IN_PROGRESS (Got ${reopenData.status})`);

  // TEST 8: SLA Engine: Dynamic countdown, percentage, and breach calculation
  printHeader('TEST 8: Dynamic SLA Engine Verification');
  const detailRes = await fetch(`${BASE_URL}/complaints/${issueId}`, {
    headers: { 'Authorization': `Bearer ${student1Token}` }
  });
  const detail = await detailRes.json();
  assert(detail.sla_hours === 6, 'SLA hours stored is 6h');
  assert(typeof detail.sla_due_date === 'string', 'SLA due date is ISO string');
  assert(typeof detail.sla_remaining_text === 'string', `SLA text generated: "${detail.sla_remaining_text}"`);
  assert(typeof detail.is_breached === 'boolean', `SLA is_breached flag is boolean: ${detail.is_breached}`);

  // TEST 9: Unauthorized student attempts to access another student's issue -> Rejected with HTTP 403
  printHeader("TEST 9: Unauthorized Student Attempts to Access Another Student's Issue -> HTTP 403");
  const intruderAccessRes = await fetch(`${BASE_URL}/complaints/${issueId}`, {
    headers: { 'Authorization': `Bearer ${student2Token}` }
  });
  assert(intruderAccessRes.status === 403, `Intruder was rejected with status 403 Forbidden (Got ${intruderAccessRes.status})`);

  // TEST 10: Unauthorized student attempts an admin/staff operation -> Rejected with HTTP 403
  printHeader('TEST 10: Unauthorized Student Attempts Admin/Staff Operation -> HTTP 403');
  const unauthorizedOpsRes = await fetch(`${BASE_URL}/reports/operations-dashboard`, {
    headers: { 'Authorization': `Bearer ${student1Token}` }
  });
  assert(unauthorizedOpsRes.status === 403, `Student blocked from Admin Analytics with status 403 (Got ${unauthorizedOpsRes.status})`);

  const unauthorizedAssignRes = await fetch(`${BASE_URL}/complaints/${issueId}/assign`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${student1Token}`
    },
    body: JSON.stringify({ staff_id: 1 })
  });
  assert(unauthorizedAssignRes.status === 403, `Student blocked from Staff Assignment with status 403 (Got ${unauthorizedAssignRes.status})`);

  // Verify Activity History on Issue Detail
  printHeader('VERIFYING PRODUCTION AUDIT / ACTIVITY TIMELINE');
  assert(Array.isArray(detail.activity_timeline), 'Activity timeline is an array');
  assert(detail.activity_timeline.length >= 3, `Recorded ${detail.activity_timeline.length} activity events for Issue #${issueId}`);
  console.log('Sample audit events recorded:');
  detail.activity_timeline.forEach((ev, idx) => {
    console.log(`  [${idx + 1}] ${ev.event_type} (${ev.actor_role}): ${ev.message}`);
  });

  printHeader('🎉 ALL 10 TESTS PASSED SUCCESSFULLY WITH ZERO REGRESSIONS!');
};

runTestSuite().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err.message);
  process.exit(1);
});
