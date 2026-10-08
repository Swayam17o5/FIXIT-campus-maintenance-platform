import { supabase } from '../config/db.js';
import asyncHandler from '../utils/asyncHandler.js';
import { logActivity } from '../utils/activity.js';

export const addResponse = asyncHandler(async (req, res) => {
  const { complaint_id, message } = req.body;
  const user = req.user;

  if (!complaint_id || !message) {
    return res.status(400).json({ message: 'complaint_id and message are required' });
  }

  const complaintId = Number(complaint_id);
  const staffId = user.id;

  const { data, error } = await supabase
    .from('response')
    .insert([{
      message: String(message).trim(),
      complaint_id: complaintId,
      staff_id: staffId
    }])
    .select('response_id')
    .single();

  if (error) throw error;

  await logActivity({
    complaintId,
    actorId: user.id,
    actorRole: user.role,
    actorName: user.name,
    eventType: 'NOTE_ADDED',
    message: `Official response added by ${user.name}: "${String(message).trim().slice(0, 80)}${message.length > 80 ? '...' : ''}"`,
    metadata: { response_id: data.response_id }
  });

  return res.status(201).json({
    message: 'Response added',
    response_id: data.response_id
  });
});

export const getResponsesByComplaint = asyncHandler(async (req, res) => {
  const complaintId = Number(req.params.complaintId);
  const user = req.user;

  // Verify access permissions
  const { data: complaint } = await supabase
    .from('complaint')
    .select('student_id')
    .eq('complaint_id', complaintId)
    .maybeSingle();

  if (complaint && user.role === 'student' && complaint.student_id !== user.id) {
    return res.status(403).json({
      message: 'Forbidden: You do not have permission to view this issue.'
    });
  }

  const { data, error } = await supabase
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

  if (error) throw error;

  const mapped = (data || []).map((r) => ({
    response_id: r.response_id,
    message: r.message,
    date_responded: r.date_responded,
    staff_id: r.staff_id,
    staff_name: r.staff?.name || 'Staff'
  }));

  return res.json(mapped);
});
