import { supabase } from '../config/db.js';
import asyncHandler from '../utils/asyncHandler.js';
import { attachSLAInfo } from '../utils/sla.js';
import { toCanonicalStatus, getSupportedColumns } from './complaints.controller.js';

export const complaintsByStatus = asyncHandler(async (req, res) => {
  const { data: rows, error } = await supabase.from('complaint').select('status');
  if (error) throw error;

  const counts = {};
  (rows || []).forEach(r => {
    const s = toCanonicalStatus(r.status);
    counts[s] = (counts[s] || 0) + 1;
  });

  res.json(Object.entries(counts).map(([status, total_complaints]) => ({ status, total_complaints })));
});

export const complaintsByCategory = asyncHandler(async (req, res) => {
  const { data: rows, error } = await supabase
    .from('complaint')
    .select('category:category_id(name)');

  if (error) throw error;

  const counts = {};
  (rows || []).forEach(r => {
    const name = r.category?.name || 'General';
    counts[name] = (counts[name] || 0) + 1;
  });

  res.json(Object.entries(counts).map(([category, count]) => ({ category, count })));
});

export const complaintsByDepartment = asyncHandler(async (req, res) => {
  const { data: rows, error } = await supabase
    .from('complaint')
    .select('department');

  if (error) throw error;

  const counts = {};
  (rows || []).forEach(r => {
    const name = r.department || 'Maintenance';
    counts[name] = (counts[name] || 0) + 1;
  });

  res.json(Object.entries(counts).map(([department, count]) => ({ department, count })));
});

export const operationsDashboard = asyncHandler(async (req, res) => {
  const cols = await getSupportedColumns();
  const hasNativeCols = cols.has('building') && cols.has('department');

  const selectCols = hasNativeCols
    ? `
      complaint_id,
      title,
      description,
      status,
      priority,
      building,
      floor,
      room,
      department,
      date_filed,
      date_resolved,
      sla_hours,
      sla_due_date,
      student:student_id (name),
      category:category_id (name),
      staff:staff_id (name)
    `
    : `
      complaint_id,
      title,
      description,
      status,
      priority,
      date_filed,
      date_resolved,
      student:student_id (name),
      category:category_id (name),
      staff:staff_id (name)
    `;

  const { data: complaints, error } = await supabase
    .from('complaint')
    .select(selectCols)
    .order('date_filed', { ascending: false });

  if (error) throw error;

  const all = complaints || [];
  let openIssues = 0;
  let inProgressIssues = 0;
  let assignedIssues = 0;
  let resolvedIssues = 0;
  let closedIssues = 0;
  let slaBreachedIssues = 0;
  let totalResolutionTimeHours = 0;
  let resolvedWithDurationCount = 0;

  const categoryMap = {};
  const statusMap = {};
  const priorityMap = {};
  const departmentMap = {};
  const locationMap = {};
  const staffWorkloadMap = {};
  const immediateAttention = [];
  const recentHighPriority = [];

  all.forEach((raw) => {
    const s = toCanonicalStatus(raw.status);
    const p = String(raw.priority || 'medium').toLowerCase();
    const bldg = raw.building || 'Academic Complex';
    const dept = raw.department || 'Maintenance';
    const staffName = raw.staff?.name || 'Unassigned';

    const normalizedItem = {
      ...raw,
      status: s,
      building: bldg,
      department: dept
    };

    const withSla = attachSLAInfo(normalizedItem);

    // Status counts
    statusMap[s] = (statusMap[s] || 0) + 1;

    // Priority counts
    priorityMap[p] = (priorityMap[p] || 0) + 1;

    // Category counts
    const catName = raw.category?.name || 'General';
    categoryMap[catName] = (categoryMap[catName] || 0) + 1;

    // Department counts
    departmentMap[dept] = (departmentMap[dept] || 0) + 1;

    // Location counts
    locationMap[bldg] = (locationMap[bldg] || 0) + 1;

    // Staff workload (active issues)
    const isCompleted = ['RESOLVED', 'VERIFIED', 'CLOSED', 'REJECTED'].includes(s);
    if (!isCompleted && staffName !== 'Unassigned') {
      staffWorkloadMap[staffName] = (staffWorkloadMap[staffName] || 0) + 1;
    }

    if (s === 'REPORTED' || s === 'UNDER_REVIEW') {
      openIssues++;
    } else if (s === 'ASSIGNED') {
      assignedIssues++;
    } else if (s === 'IN_PROGRESS') {
      inProgressIssues++;
    } else if (s === 'RESOLVED') {
      resolvedIssues++;
      if (raw.date_resolved && raw.date_filed) {
        const diffHours = (new Date(raw.date_resolved) - new Date(raw.date_filed)) / (1000 * 3600);
        if (diffHours >= 0) {
          totalResolutionTimeHours += diffHours;
          resolvedWithDurationCount++;
        }
      }
    } else if (s === 'VERIFIED' || s === 'CLOSED') {
      closedIssues++;
    }

    // SLA tracking for active issues
    if (!isCompleted) {
      if (withSla.is_breached) {
        slaBreachedIssues++;
        immediateAttention.push(withSla);
      } else if (p === 'critical') {
        immediateAttention.push(withSla);
      }
    }

    // Recent high/critical issues
    if (['critical', 'high'].includes(p) && recentHighPriority.length < 8) {
      recentHighPriority.push(withSla);
    }
  });

  const total = all.length;
  const totalFinished = resolvedIssues + closedIssues;
  const resolutionRate = total > 0 ? Math.round((totalFinished / total) * 100) : 0;
  const avgResolutionTimeHours = resolvedWithDurationCount > 0
    ? Number((totalResolutionTimeHours / resolvedWithDurationCount).toFixed(1))
    : 0;

  const totalActive = openIssues + assignedIssues + inProgressIssues;
  const slaCompliance = total > 0
    ? Math.max(0, Math.round(((total - slaBreachedIssues) / total) * 100))
    : 100;

  return res.json({
    kpis: {
      totalIssues: total,
      openIssues,
      assignedIssues,
      inProgressIssues,
      resolvedIssues,
      closedIssues,
      slaBreachedIssues,
      avgResolutionTimeHours,
      resolutionRate,
      slaCompliance
    },
    byCategory: Object.entries(categoryMap).map(([category, count]) => ({ category, count })),
    byStatus: Object.entries(statusMap).map(([status, count]) => ({ status, count })),
    byPriority: Object.entries(priorityMap).map(([priority, count]) => ({ priority, count })),
    byDepartment: Object.entries(departmentMap).map(([department, count]) => ({ department, count })),
    byLocation: Object.entries(locationMap).map(([building, count]) => ({ building, count })),
    staffWorkload: Object.entries(staffWorkloadMap).map(([staff, count]) => ({ staff, count })),
    recentHighPriority: recentHighPriority.slice(0, 6),
    immediateAttention: immediateAttention.slice(0, 10)
  });
});

export const issuesByLocation = asyncHandler(async (req, res) => {
  const { data: rows, error } = await supabase.from('complaint').select('building, status');
  if (error) throw error;

  const buildingCounts = {};
  (rows || []).forEach((r) => {
    const bldg = r.building || 'Academic Complex';
    const s = toCanonicalStatus(r.status);
    const isResolved = ['RESOLVED', 'VERIFIED', 'CLOSED'].includes(s);

    if (!buildingCounts[bldg]) {
      buildingCounts[bldg] = { building: bldg, total_issues: 0, active_issues: 0, resolved_issues: 0 };
    }
    buildingCounts[bldg].total_issues++;
    if (isResolved) {
      buildingCounts[bldg].resolved_issues++;
    } else {
      buildingCounts[bldg].active_issues++;
    }
  });

  return res.json(Object.values(buildingCounts));
});

export const openComplaintsDashboard = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('complaint')
    .select(`
      complaint_id,
      title,
      status,
      priority,
      date_filed,
      building,
      room,
      student:student_id(name),
      category:category_id(name),
      staff:staff_id(name)
    `)
    .in('status', ['REPORTED', 'UNDER_REVIEW', 'ASSIGNED', 'IN_PROGRESS', 'pending', 'open', 'in_progress'])
    .order('date_filed', { ascending: true });

  if (error) throw error;

  const mapped = (data || []).map((r) => ({
    ...attachSLAInfo(r),
    status: toCanonicalStatus(r.status),
    student_name: r.student?.name || 'Unknown',
    category: r.category?.name || 'General',
    assigned_to: r.staff?.name || 'Unassigned'
  }));

  res.json(mapped);
});

export const staffPerformance = asyncHandler(async (req, res) => {
  const { data: staffList, error: stErr } = await supabase
    .from('staff')
    .select('staff_id, name, department');

  if (stErr) throw stErr;

  const { data: complaints, error: cErr } = await supabase
    .from('complaint')
    .select('staff_id, status, date_filed, date_resolved');

  if (cErr) throw cErr;

  const performance = (staffList || []).map((st) => {
    const assigned = (complaints || []).filter((c) => c.staff_id === st.staff_id);
    const resolved = assigned.filter((c) => ['RESOLVED', 'VERIFIED', 'CLOSED', 'resolved', 'closed'].includes(c.status));
    const active = assigned.length - resolved.length;

    return {
      staff_id: st.staff_id,
      name: st.name,
      department: st.department || 'Maintenance',
      assigned_count: assigned.length,
      active_count: active,
      resolved_count: resolved.length
    };
  });

  res.json(performance);
});

export const averageResolutionTime = asyncHandler(async (req, res) => {
  const { data: rows, error } = await supabase
    .from('complaint')
    .select('date_filed, date_resolved, category:category_id(name)')
    .not('date_resolved', 'is', null);

  if (error) throw error;

  let totalDiff = 0;
  let count = 0;

  (rows || []).forEach((r) => {
    if (r.date_filed && r.date_resolved) {
      const diffHours = (new Date(r.date_resolved) - new Date(r.date_filed)) / (1000 * 3600);
      if (diffHours >= 0) {
        totalDiff += diffHours;
        count++;
      }
    }
  });

  const avgHours = count > 0 ? Number((totalDiff / count).toFixed(1)) : 0;
  res.json({ average_resolution_hours: avgHours, resolved_count: count });
});
