import { supabase } from '../config/db.js';

export const logActivity = async ({
  complaintId,
  actorId = null,
  actorRole = 'system',
  actorName = 'System',
  eventType,
  message,
  metadata = {}
}) => {
  try {
    const payload = {
      complaint_id: Number(complaintId),
      actor_id: actorId ? Number(actorId) : null,
      actor_role: String(actorRole).toLowerCase(),
      actor_name: String(actorName || 'System'),
      event_type: String(eventType).toUpperCase(),
      message: String(message),
      metadata: metadata || {}
    };

    const { error } = await supabase.from('activity_log').insert([payload]);
    if (error && error.code !== 'PGRST205') {
      console.warn('Activity log insert error:', error.message);
    }
  } catch (err) {
    console.warn('Failed to record activity log:', err.message);
  }

  // Also log to complaint_audit table if status changed
  try {
    if (metadata && (metadata.new_status || metadata.old_status)) {
      await supabase.from('complaint_audit').insert([{
        complaint_id: Number(complaintId),
        old_status: metadata.old_status || null,
        new_status: metadata.new_status || null,
        changed_by: actorName || 'System',
        changed_at: new Date().toISOString()
      }]);
    }
  } catch (e) {
    // ignore
  }
};

export const fetchActivityTimeline = async (complaintId, complaint = null) => {
  // 1. Try activity_log table
  try {
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .eq('complaint_id', Number(complaintId))
      .order('created_at', { ascending: true });

    if (!error && data && data.length > 0) {
      return data.map((a) => ({
        activity_id: a.activity_id,
        event_type: a.event_type,
        message: a.message,
        actor_name: a.actor_name,
        actor_role: a.actor_role,
        metadata: a.metadata,
        created_at: a.created_at
      }));
    }
  } catch (err) {
    // fallback
  }

  // 2. Fallback to existing complaint_audit table
  try {
    const { data: audits } = await supabase
      .from('complaint_audit')
      .select('*')
      .eq('complaint_id', Number(complaintId))
      .order('changed_at', { ascending: true });

    if (audits && audits.length > 0) {
      return audits.map((a) => ({
        activity_id: a.audit_id,
        event_type: 'STATUS_CHANGED',
        message: `Status moved to ${a.new_status}${a.old_status ? ` (from ${a.old_status})` : ''}`,
        actor_name: a.changed_by || 'Staff',
        actor_role: 'staff',
        created_at: a.changed_at
      }));
    }
  } catch (e) {
    // ignore
  }

  // 3. Synthesize timeline from complaint record
  if (complaint) {
    const events = [];
    if (complaint.date_filed) {
      events.push({
        activity_id: 1,
        event_type: 'ISSUE_CREATED',
        message: `Issue reported: ${complaint.title}`,
        actor_name: complaint.student?.name || 'Student',
        actor_role: 'student',
        created_at: complaint.date_filed
      });
    }
    if (complaint.assigned_at) {
      events.push({
        activity_id: 2,
        event_type: 'ISSUE_ASSIGNED',
        message: `Assigned to ${complaint.staff?.name || 'Staff member'} (${complaint.department || 'Maintenance'})`,
        actor_name: 'Administrator',
        actor_role: 'admin',
        created_at: complaint.assigned_at
      });
    }
    if (complaint.date_resolved) {
      events.push({
        activity_id: 3,
        event_type: 'ISSUE_RESOLVED',
        message: `Issue resolved: ${complaint.resolution_notes || 'Fixed and tested'}`,
        actor_name: complaint.staff?.name || 'Technician',
        actor_role: 'staff',
        created_at: complaint.date_resolved
      });
    }
    if (complaint.verified_at) {
      events.push({
        activity_id: 4,
        event_type: 'STUDENT_VERIFIED',
        message: 'Resolution confirmed and verified by student',
        actor_name: complaint.student?.name || 'Student',
        actor_role: 'student',
        created_at: complaint.verified_at
      });
    }
    return events;
  }

  return [];
};
