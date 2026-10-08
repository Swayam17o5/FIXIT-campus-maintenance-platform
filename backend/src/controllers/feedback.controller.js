import { supabase } from '../config/db.js';
import asyncHandler from '../utils/asyncHandler.js';
import { logActivity } from '../utils/activity.js';

export const createFeedback = asyncHandler(async (req, res) => {
  const { complaint_id, rating, message = null } = req.body;
  const user = req.user;

  if (!complaint_id || rating === undefined) {
    return res.status(400).json({ message: 'complaint_id and rating are required' });
  }

  const numericRating = Number(rating);
  if (isNaN(numericRating) || numericRating < 1 || numericRating > 5) {
    return res.status(400).json({ message: 'rating must be an integer between 1 and 5' });
  }

  const complaintId = Number(complaint_id);

  // Verify complaint exists and student owns it
  const { data: complaint, error: compErr } = await supabase
    .from('complaint')
    .select('complaint_id, student_id, status')
    .eq('complaint_id', complaintId)
    .maybeSingle();

  if (compErr) throw compErr;
  if (!complaint) {
    return res.status(404).json({ message: 'Complaint not found' });
  }

  if (user.role === 'student' && complaint.student_id !== user.id) {
    return res.status(403).json({
      message: 'Forbidden: You can only submit feedback for your own issues.'
    });
  }

  const studentId = user.role === 'student' ? user.id : complaint.student_id;

  const { data, error } = await supabase
    .from('feedback')
    .insert([{
      message: message ? String(message).trim() : null,
      rating: numericRating,
      complaint_id: complaintId,
      student_id: studentId
    }])
    .select('feedback_id')
    .single();

  if (error) throw error;

  await logActivity({
    complaintId,
    actorId: user.id,
    actorRole: user.role,
    actorName: user.name,
    eventType: 'FEEDBACK_SUBMITTED',
    message: `Student submitted resolution feedback (${numericRating}/5 stars)`,
    metadata: { rating: numericRating, message }
  });

  return res.status(201).json({
    message: 'Feedback submitted successfully',
    feedback_id: data.feedback_id
  });
});

export const getFeedbackByComplaint = asyncHandler(async (req, res) => {
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
      message: 'Forbidden: You can only view feedback for your own issues.'
    });
  }

  const { data, error } = await supabase
    .from('feedback')
    .select('feedback_id, message, rating, date, complaint_id, student_id')
    .eq('complaint_id', complaintId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ message: 'Feedback not found for this complaint' });
  }

  return res.json(data);
});
