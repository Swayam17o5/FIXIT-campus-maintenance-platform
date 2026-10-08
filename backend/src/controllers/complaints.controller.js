import { supabase } from '../config/db.js';
import asyncHandler from '../utils/asyncHandler.js';
import { calculateSLA, attachSLAInfo } from '../utils/sla.js';
import {
  CANONICAL_STATUSES,
  normalizeStatus,
  validateTransition
} from '../utils/lifecycle.js';
import { logActivity, fetchActivityTimeline } from '../utils/activity.js';

const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'];

// Helper to check supported columns in Supabase
let cachedColumns = null;
let cacheTimestamp = 0;

export const getSupportedColumns = async () => {
  const now = Date.now();
  if (cachedColumns && (now - cacheTimestamp < 30000)) {
    return cachedColumns;
  }
  try {
    const { data, error } = await supabase.from('complaint').select('*').limit(1);
    if (!error && data && data.length > 0) {
      cachedColumns = new Set(Object.keys(data[0]));
      cacheTimestamp = now;
      return cachedColumns;
    }
  } catch (err) {
    // fallback
  }
  return new Set([
    'complaint_id', 'title', 'description', 'status', 'priority',
    'date_filed', 'date_resolved', 'student_id', 'category_id', 'staff_id',
    'building', 'floor', 'room', 'location_description', 'department',
    'rejection_reason', 'resolution_notes', 'sla_hours', 'sla_due_date',
    'assigned_at', 'verified_at', 'closed_at'
  ]);
};

// Map legacy status strings to canonical uppercase
export const toCanonicalStatus = (status) => {
  return normalizeStatus(status);
};

export const createComplaint = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    category_id,
    priority = 'medium',
    building = 'Academic Complex',
    floor = 'Ground Floor',
    room = 'General',
    location_description = null,
    department = null,
    staff_id = null
  } = req.body;

  // Enforce student ownership via authenticated JWT
  const studentId = req.user.role === 'student' ? req.user.id : Number(req.body.student_id || req.user.id);
  const categoryId = Number(category_id);

  if (!title || !description || !categoryId) {
    return res.status(400).json({
      message: 'title, description, and category_id are required'
    });
  }

  if (!studentId || isNaN(studentId)) {
    return res.status(400).json({ message: 'Valid student_id is required' });
  }

  if (isNaN(categoryId)) {
    return res.status(400).json({ message: 'Valid category_id is required' });
  }

  // Validate student existence
  const { data: studentRecord, error: stuErr } = await supabase
    .from('student')
    .select('student_id, name')
    .eq('student_id', studentId)
    .maybeSingle();

  if (stuErr) throw stuErr;
  if (!studentRecord) {
    return res.status(400).json({
      message: `Student with ID ${studentId} does not exist.`
    });
  }

  // Validate category existence
  const { data: catRecord, error: catErr } = await supabase
    .from('category')
    .select('category_id, name')
    .eq('category_id', categoryId)
    .maybeSingle();

  if (catErr) throw catErr;
  if (!catRecord) {
    return res.status(400).json({
      message: `Category with ID ${categoryId} does not exist.`
    });
  }

  const normalizedPriority = String(priority).toLowerCase();
  if (!VALID_PRIORITIES.includes(normalizedPriority)) {
    return res.status(400).json({
      message: 'Invalid priority value (choose low, medium, high, critical)'
    });
  }

  // Calculate dynamic SLA based on priority & submission time
  const sla = calculateSLA(normalizedPriority);
  const cols = await getSupportedColumns();

  // Clean description: preserve pure user text without embedding metadata
  const pureDescription = String(description).replace(/\s*\[Location:.*?\]/s, '').trim();

  const payload = {
    title: String(title).trim(),
    description: pureDescription,
    status: 'REPORTED',
    priority: normalizedPriority,
    student_id: studentId,
    category_id: categoryId,
    staff_id: staff_id ? Number(staff_id) : null
  };

  // Add native location & SLA columns if supported
  if (cols.has('building')) payload.building = building ? String(building).trim() : 'Academic Complex';
  if (cols.has('floor')) payload.floor = floor ? String(floor).trim() : 'Ground Floor';
  if (cols.has('room')) payload.room = room ? String(room).trim() : 'General';
  if (cols.has('location_description')) payload.location_description = location_description ? String(location_description).trim() : null;
  if (cols.has('department')) payload.department = department ? String(department).trim() : null;
  if (cols.has('sla_hours')) payload.sla_hours = sla.slaHours;
  if (cols.has('sla_due_date')) payload.sla_due_date = sla.dueDate;

  let insertRes = await supabase
    .from('complaint')
    .insert([payload])
    .select('complaint_id')
    .single();

  // Backward-compatibility fallback if database still has legacy constraint 'pending'
  if (insertRes.error && insertRes.error.code === '23514') {
    payload.status = 'pending';
    insertRes = await supabase
      .from('complaint')
      .insert([payload])
      .select('complaint_id')
      .single();
  }

  if (insertRes.error) throw insertRes.error;

  const complaintId = insertRes.data.complaint_id;

  // Log activity in production audit trail
  await logActivity({
    complaintId,
    actorId: req.user.id,
    actorRole: req.user.role,
    actorName: req.user.name,
    eventType: 'ISSUE_CREATED',
    message: `Issue reported: ${title}`,
    metadata: {
      priority: normalizedPriority,
      sla_hours: sla.slaHours,
      category: catRecord.name,
      building: payload.building,
      room: payload.room
    }
  });

  return res.status(201).json({
    message: 'Issue reported successfully',
    complaint_id: complaintId,
    status: 'REPORTED',
    sla_hours: sla.slaHours,
    sla_due_date: sla.dueDate
  });
});

export const listComplaints = asyncHandler(async (req, res) => {
  const {
    status,
    priority,
    student_id,
    staff_id,
    category_id,
    department,
    building,
    q,
    breached,
    page = 1,
    limit = 50
  } = req.query;

  const user = req.user;
  const pageNo = Math.max(Number(page), 1);
  const pageSize = Math.min(Math.max(Number(limit), 1), 100);
  const from = (pageNo - 1) * pageSize;
  const to = from + pageSize - 1;

  const cols = await getSupportedColumns();
  const hasExtendedCols = cols.has('building') && cols.has('verified_at');

  const selectFields = hasExtendedCols
    ? `
      complaint_id,
      title,
      description,
      status,
      priority,
      building,
      floor,
      room,
      location_description,
      department,
      rejection_reason,
      resolution_notes,
      sla_hours,
      sla_due_date,
      date_filed,
      assigned_at,
      date_resolved,
      verified_at,
      closed_at,
      student_id,
      student:student_id (name, email, phone, department),
      category_id,
      category:category_id (name),
      staff_id,
      staff:staff_id (name, email, department, role)
    `
    : `
      complaint_id,
      title,
      description,
      status,
      priority,
      date_filed,
      date_resolved,
      student_id,
      student:student_id (name, email, phone, department),
      category_id,
      category:category_id (name),
      staff_id,
      staff:staff_id (name, email, department, role)
    `;

  let queryBuilder = supabase
    .from('complaint')
    .select(selectFields, { count: 'exact' });

  // RBAC SCOPING:
  // If user is a STUDENT, they can ONLY view their own complaints
  if (user && user.role === 'student') {
    queryBuilder = queryBuilder.eq('student_id', user.id);
  } else if (student_id) {
    queryBuilder = queryBuilder.eq('student_id', Number(student_id));
  }

  // Staff assigned filter
  if (staff_id) {
    if (staff_id === 'me' && user) {
      queryBuilder = queryBuilder.eq('staff_id', user.id);
    } else if (staff_id === 'unassigned') {
      queryBuilder = queryBuilder.is('staff_id', null);
    } else {
      queryBuilder = queryBuilder.eq('staff_id', Number(staff_id));
    }
  }

  // Canonical status filtering
  if (status) {
    const s = String(status).toUpperCase();
    if (s === 'OPEN') {
      queryBuilder = queryBuilder.in('status', ['REPORTED', 'UNDER_REVIEW', 'pending', 'open']);
    } else {
      queryBuilder = queryBuilder.ilike('status', s);
    }
  }

  if (priority) {
    queryBuilder = queryBuilder.eq('priority', String(priority).toLowerCase());
  }

  if (category_id) {
    queryBuilder = queryBuilder.eq('category_id', Number(category_id));
  }

  if (department && cols.has('department')) {
    queryBuilder = queryBuilder.ilike('department', `%${department}%`);
  }

  if (building && cols.has('building')) {
    queryBuilder = queryBuilder.ilike('building', `%${building}%`);
  }

  // Server-side search by title, ID, building, or room
  if (q) {
    const qTrim = String(q).trim();
    const isNum = !isNaN(Number(qTrim));
    if (isNum) {
      queryBuilder = queryBuilder.or(`complaint_id.eq.${Number(qTrim)},title.ilike.%${qTrim}%`);
    } else if (cols.has('building')) {
      queryBuilder = queryBuilder.or(`title.ilike.%${qTrim}%,building.ilike.%${qTrim}%,room.ilike.%${qTrim}%`);
    } else {
      queryBuilder = queryBuilder.ilike('title', `%${qTrim}%`);
    }
  }

  const { data, count, error } = await queryBuilder
    .order('date_filed', { ascending: false })
    .range(from, to);

  if (error) throw error;

  let mapped = (data || []).map((c) => {
    const normalized = {
      ...c,
      status: toCanonicalStatus(c.status),
      building: c.building || 'Academic Complex',
      floor: c.floor || 'Ground Floor',
      room: c.room || 'General'
    };
    const withSla = attachSLAInfo(normalized);
    return {
      ...withSla,
      student_name: c.student?.name || 'Unknown',
      category: c.category?.name || 'General',
      assigned_staff: c.staff?.name || 'Unassigned'
    };
  });

  if (breached === 'true') {
    mapped = mapped.filter((item) => item.is_breached);
  }

  return res.json({
    page: pageNo,
    limit: pageSize,
    total: count ?? mapped.length,
    data: mapped
  });
});

export const getComplaintById = asyncHandler(async (req, res) => {
  const complaintId = Number(req.params.id);
  const user = req.user;

  if (!complaintId || isNaN(complaintId)) {
    return res.status(400).json({ message: 'Valid issue ID is required' });
  }

  const cols = await getSupportedColumns();
  const hasExtendedCols = cols.has('building') && cols.has('verified_at');

  const selectFields = hasExtendedCols
    ? `
      complaint_id,
      title,
      description,
      status,
      priority,
      building,
      floor,
      room,
      location_description,
      department,
      rejection_reason,
      resolution_notes,
      sla_hours,
      sla_due_date,
      date_filed,
      assigned_at,
      date_resolved,
      verified_at,
      closed_at,
      student_id,
      student:student_id (name, email, phone, department),
      category_id,
      category:category_id (name),
      staff_id,
      staff:staff_id (name, email, department, role)
    `
    : `
      complaint_id,
      title,
      description,
      status,
      priority,
      date_filed,
      date_resolved,
      student_id,
      student:student_id (name, email, phone, department),
      category_id,
      category:category_id (name),
      staff_id,
      staff:staff_id (name, email, department, role)
    `;

  const { data: complaint, error: compError } = await supabase
    .from('complaint')
    .select(selectFields)
    .eq('complaint_id', complaintId)
    .maybeSingle();

  if (compError) throw compError;
  if (!complaint) {
    return res.status(404).json({ message: 'Issue not found' });
  }

  // RBAC ENFORCEMENT:
  // If user is a student, verify they OWN this complaint!
  if (user && user.role === 'student' && complaint.student_id !== user.id) {
    return res.status(403).json({
      message: "Forbidden: You do not have permission to access another student's issue report."
    });
  }

  // Fetch responses (conversation messages)
  const { data: responses } = await supabase
    .from('response')
    .select(`
      response_id,
      message,
      date_responded,
      staff_id,
      staff:staff_id (name)
    `)
    .eq('complaint_id', complaintId)
    .order('date_responded', { ascending: false });

  // Fetch production activity log
  const timeline = await fetchActivityTimeline(complaintId, complaint);

  // Fetch assignment history
  let history = [];
  try {
    const { data: histData } = await supabase
      .from('assignment_history')
      .select(`
        assignment_id,
        assigned_at,
        department,
        notes,
        staff:staff_id (name)
      `)
      .eq('complaint_id', complaintId)
      .order('assigned_at', { ascending: false });
    if (histData) history = histData;
  } catch (e) {
    // ignore
  }

  // Fetch feedback
  const { data: feedback } = await supabase
    .from('feedback')
    .select('feedback_id, message, rating, date, student_id')
    .eq('complaint_id', complaintId)
    .maybeSingle();

  const normalizedComplaint = {
    ...complaint,
    status: toCanonicalStatus(complaint.status),
    building: complaint.building || 'Academic Complex',
    floor: complaint.floor || 'Ground Floor',
    room: complaint.room || 'General'
  };

  const withSla = attachSLAInfo(normalizedComplaint);

  const mappedResponses = (responses || []).map((r) => ({
    response_id: r.response_id,
    message: r.message,
    date_responded: r.date_responded,
    staff_id: r.staff_id,
    staff_name: r.staff?.name || 'Staff'
  }));

  const mappedHistory = history.map((h) => ({
    assignment_id: h.assignment_id,
    assigned_at: h.assigned_at,
    department: h.department,
    notes: h.notes,
    staff_name: h.staff?.name || 'Unassigned'
  }));

  return res.json({
    ...withSla,
    student_name: complaint.student?.name || 'Unknown',
    student_email: complaint.student?.email,
    category: complaint.category?.name || 'General',
    assigned_staff: complaint.staff?.name || 'Unassigned',
    responses: mappedResponses,
    activity_timeline: timeline,
    assignment_history: mappedHistory,
    feedback: feedback || null
  });
});

export const updateComplaint = asyncHandler(async (req, res) => {
  const complaintId = Number(req.params.id);
  const user = req.user;

  const {
    title,
    description,
    status,
    priority,
    category_id,
    staff_id,
    building,
    floor,
    room,
    location_description,
    department,
    rejection_reason,
    resolution_notes,
    operational_notes
  } = req.body;

  const { data: current, error: getErr } = await supabase
    .from('complaint')
    .select('*')
    .eq('complaint_id', complaintId)
    .maybeSingle();

  if (getErr) throw getErr;
  if (!current) {
    return res.status(404).json({ message: 'Issue not found' });
  }

  // RBAC: Staff can only update issues assigned to them!
  if (user.role === 'staff' && current.staff_id !== user.id) {
    return res.status(403).json({
      message: 'Forbidden: Staff can only update issues assigned to them.'
    });
  }

  const cols = await getSupportedColumns();
  const updates = {};
  const currentStatus = toCanonicalStatus(current.status);

  // Field updates
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (category_id !== undefined) updates.category_id = Number(category_id);
  if (department !== undefined && cols.has('department')) updates.department = department;

  if (cols.has('building') && building !== undefined) updates.building = building;
  if (cols.has('floor') && floor !== undefined) updates.floor = floor;
  if (cols.has('room') && room !== undefined) updates.room = room;
  if (cols.has('location_description') && location_description !== undefined) {
    updates.location_description = location_description;
  }

  // Priority change (Admin only)
  if (priority !== undefined) {
    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: Only administrators can modify issue priority' });
    }
    const p = String(priority).toLowerCase();
    if (!VALID_PRIORITIES.includes(p)) {
      return res.status(400).json({ message: 'Invalid priority value' });
    }
    updates.priority = p;
    const sla = calculateSLA(p, current.date_filed);
    if (cols.has('sla_hours')) updates.sla_hours = sla.slaHours;
    if (cols.has('sla_due_date')) updates.sla_due_date = sla.dueDate;

    await logActivity({
      complaintId,
      actorId: user.id,
      actorRole: user.role,
      actorName: user.name,
      eventType: 'PRIORITY_CHANGED',
      message: `Priority updated to ${p.toUpperCase()} (Target SLA: ${sla.slaHours}h)`,
      metadata: { old_priority: current.priority, new_priority: p, sla_hours: sla.slaHours }
    });
  }

  // Lifecycle status transition
  if (status !== undefined) {
    const targetStatus = normalizeStatus(status);
    const transitionCheck = validateTransition(currentStatus, targetStatus, {
      rejection_reason,
      resolution_notes
    });

    if (!transitionCheck.valid) {
      return res.status(400).json({ message: transitionCheck.message });
    }

    updates.status = targetStatus;

    if (cols.has('rejection_reason') && rejection_reason !== undefined) {
      updates.rejection_reason = rejection_reason;
    }
    if (cols.has('resolution_notes') && resolution_notes !== undefined) {
      updates.resolution_notes = resolution_notes;
    }

    if (targetStatus === 'RESOLVED') {
      updates.date_resolved = new Date().toISOString();
      await logActivity({
        complaintId,
        actorId: user.id,
        actorRole: user.role,
        actorName: user.name,
        eventType: 'ISSUE_RESOLVED',
        message: `Issue marked as RESOLVED by ${user.name}. Resolution Notes: ${resolution_notes || 'None provided'}`,
        metadata: { resolution_notes }
      });
    } else if (targetStatus === 'REJECTED') {
      await logActivity({
        complaintId,
        actorId: user.id,
        actorRole: user.role,
        actorName: user.name,
        eventType: 'ISSUE_REJECTED',
        message: `Issue rejected. Reason: ${rejection_reason}`,
        metadata: { rejection_reason }
      });
    } else if (targetStatus === 'CLOSED') {
      if (cols.has('closed_at')) updates.closed_at = new Date().toISOString();
      await logActivity({
        complaintId,
        actorId: user.id,
        actorRole: user.role,
        actorName: user.name,
        eventType: 'ISSUE_CLOSED',
        message: `Issue closed by ${user.name}`,
        metadata: {}
      });
    } else {
      await logActivity({
        complaintId,
        actorId: user.id,
        actorRole: user.role,
        actorName: user.name,
        eventType: 'STATUS_CHANGED',
        message: `Status moved from ${currentStatus} to ${targetStatus}`,
        metadata: { old_status: currentStatus, new_status: targetStatus }
      });
    }
  }

  // Operational note added
  if (operational_notes) {
    await logActivity({
      complaintId,
      actorId: user.id,
      actorRole: user.role,
      actorName: user.name,
      eventType: 'NOTE_ADDED',
      message: `Operational Note: ${operational_notes}`,
      metadata: { operational_notes }
    });
  }

  let updateRes = await supabase
    .from('complaint')
    .update(updates)
    .eq('complaint_id', complaintId);

  // Fallback for legacy check constraint
  if (updateRes.error && updateRes.error.code === '23514' && updates.status) {
    updates.status = updates.status.toLowerCase();
    updateRes = await supabase
      .from('complaint')
      .update(updates)
      .eq('complaint_id', complaintId);
  }

  if (updateRes.error) throw updateRes.error;

  return res.json({
    message: 'Issue updated successfully',
    status: updates.status ? toCanonicalStatus(updates.status) : currentStatus
  });
});

export const assignComplaint = asyncHandler(async (req, res) => {
  const complaintId = Number(req.params.id);
  const user = req.user;
  const { staff_id, department = null, notes = null } = req.body;

  if (!complaintId || isNaN(complaintId)) {
    return res.status(400).json({ message: 'Valid complaint ID is required' });
  }

  let normalizedStaffId = null;
  let staffName = 'Unassigned';

  if (staff_id !== null && staff_id !== undefined && staff_id !== '') {
    normalizedStaffId = Number(staff_id);
    if (!Number.isInteger(normalizedStaffId) || normalizedStaffId <= 0) {
      return res.status(400).json({ message: 'staff_id must be a valid positive integer or null' });
    }

    const { data: staff, error } = await supabase
      .from('staff')
      .select('staff_id, name, department')
      .eq('staff_id', normalizedStaffId)
      .maybeSingle();

    if (error) throw error;
    if (!staff) return res.status(404).json({ message: 'Staff member not found' });
    staffName = staff.name;
  }

  const { data: current, error: getErr } = await supabase
    .from('complaint')
    .select('status')
    .eq('complaint_id', complaintId)
    .maybeSingle();

  if (getErr) throw getErr;
  if (!current) return res.status(404).json({ message: 'Issue not found' });

  const currentStatus = toCanonicalStatus(current.status);
  let newStatus = currentStatus;

  if (normalizedStaffId && (currentStatus === 'REPORTED' || currentStatus === 'UNDER_REVIEW')) {
    newStatus = 'ASSIGNED';
  } else if (!normalizedStaffId && currentStatus === 'ASSIGNED') {
    newStatus = 'UNDER_REVIEW';
  }

  const cols = await getSupportedColumns();
  const nowIso = new Date().toISOString();

  const updatePayload = {
    staff_id: normalizedStaffId,
    status: newStatus
  };

  if (cols.has('department')) updatePayload.department = department || null;
  if (cols.has('assigned_at')) updatePayload.assigned_at = normalizedStaffId ? nowIso : null;

  let updRes = await supabase
    .from('complaint')
    .update(updatePayload)
    .eq('complaint_id', complaintId);

  if (updRes.error && updRes.error.code === '23514') {
    updatePayload.status = newStatus === 'ASSIGNED' ? 'in_progress' : 'open';
    updRes = await supabase
      .from('complaint')
      .update(updatePayload)
      .eq('complaint_id', complaintId);
  }

  if (updRes.error) throw updRes.error;

  // Record assignment history
  if (normalizedStaffId) {
    try {
      await supabase
        .from('assignment_history')
        .insert([{
          complaint_id: complaintId,
          staff_id: normalizedStaffId,
          department: department || null,
          notes: notes || null,
          assigned_by: user.id,
          assigned_at: nowIso
        }]);
    } catch (e) {
      // ignore
    }
  }

  // Record production activity log
  await logActivity({
    complaintId,
    actorId: user.id,
    actorRole: user.role,
    actorName: user.name,
    eventType: normalizedStaffId ? 'ISSUE_ASSIGNED' : 'ISSUE_UNASSIGNED',
    message: normalizedStaffId
      ? `Assigned to ${staffName} (${department || 'General'}) by ${user.name}`
      : `Unassigned from staff by ${user.name}`,
    metadata: { staff_id: normalizedStaffId, staff_name: staffName, department, notes }
  });

  return res.json({
    message: normalizedStaffId ? `Issue assigned to ${staffName}` : 'Issue unassigned',
    status: newStatus
  });
});

export const verifyComplaint = asyncHandler(async (req, res) => {
  const complaintId = Number(req.params.id);
  const user = req.user;

  const { data: current, error: getErr } = await supabase
    .from('complaint')
    .select('status, student_id')
    .eq('complaint_id', complaintId)
    .maybeSingle();

  if (getErr) throw getErr;
  if (!current) return res.status(404).json({ message: 'Issue not found' });

  // RBAC: Only the student who reported this issue can verify it!
  if (current.student_id !== user.id) {
    return res.status(403).json({
      message: 'Forbidden: Only the student who reported this issue can verify its resolution.'
    });
  }

  const currentStatus = toCanonicalStatus(current.status);
  if (currentStatus !== 'RESOLVED') {
    return res.status(400).json({
      message: `Only issues in 'RESOLVED' state can be verified. Current status is '${currentStatus}'.`
    });
  }

  const cols = await getSupportedColumns();
  const updatePayload = { status: 'VERIFIED' };
  if (cols.has('verified_at')) {
    updatePayload.verified_at = new Date().toISOString();
  }

  let updRes = await supabase
    .from('complaint')
    .update(updatePayload)
    .eq('complaint_id', complaintId);

  if (updRes.error && updRes.error.code === '23514') {
    updatePayload.status = 'closed';
    updRes = await supabase
      .from('complaint')
      .update(updatePayload)
      .eq('complaint_id', complaintId);
  }

  if (updRes.error) throw updRes.error;

  // Log activity
  await logActivity({
    complaintId,
    actorId: user.id,
    actorRole: 'student',
    actorName: user.name,
    eventType: 'STUDENT_VERIFIED',
    message: `Resolution confirmed and verified by student ${user.name}`,
    metadata: {}
  });

  return res.json({
    message: 'Resolution verified successfully',
    status: 'VERIFIED'
  });
});

export const reopenComplaint = asyncHandler(async (req, res) => {
  const complaintId = Number(req.params.id);
  const user = req.user;
  const { reason = 'Issue remains unresolved' } = req.body;

  const { data: current, error: getErr } = await supabase
    .from('complaint')
    .select('status, student_id')
    .eq('complaint_id', complaintId)
    .maybeSingle();

  if (getErr) throw getErr;
  if (!current) return res.status(404).json({ message: 'Issue not found' });

  // RBAC: Only the student who reported this issue can reopen it!
  if (current.student_id !== user.id) {
    return res.status(403).json({
      message: 'Forbidden: Only the student who reported this issue can reopen it.'
    });
  }

  const currentStatus = toCanonicalStatus(current.status);
  if (currentStatus !== 'RESOLVED') {
    return res.status(400).json({
      message: `Only issues in 'RESOLVED' state can be reopened. Current status is '${currentStatus}'.`
    });
  }

  const cols = await getSupportedColumns();
  const updatePayload = {
    status: 'IN_PROGRESS',
    date_resolved: null
  };

  if (cols.has('resolution_notes')) {
    updatePayload.resolution_notes = `Reopened by student: ${reason}`;
  }

  let updRes = await supabase
    .from('complaint')
    .update(updatePayload)
    .eq('complaint_id', complaintId);

  if (updRes.error && updRes.error.code === '23514') {
    updatePayload.status = 'in_progress';
    updRes = await supabase
      .from('complaint')
      .update(updatePayload)
      .eq('complaint_id', complaintId);
  }

  if (updRes.error) throw updRes.error;

  // Log activity
  await logActivity({
    complaintId,
    actorId: user.id,
    actorRole: 'student',
    actorName: user.name,
    eventType: 'ISSUE_REOPENED',
    message: `Issue reopened by student ${user.name}. Reason: ${reason}`,
    metadata: { reopen_reason: reason }
  });

  return res.json({
    message: 'Issue has been reopened for staff investigation',
    status: 'IN_PROGRESS'
  });
});

export const deleteComplaint = asyncHandler(async (req, res) => {
  const complaintId = Number(req.params.id);
  const user = req.user;

  // RBAC: Admin only
  if (user.role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden: Only administrators can delete issues' });
  }

  const { data, error } = await supabase
    .from('complaint')
    .delete()
    .eq('complaint_id', complaintId)
    .select();

  if (error) throw error;
  if (!data || !data.length) {
    return res.status(404).json({ message: 'Issue not found' });
  }

  return res.json({ message: 'Issue deleted successfully' });
});
