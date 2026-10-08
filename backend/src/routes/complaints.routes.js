import { Router } from 'express';
import {
  assignComplaint,
  createComplaint,
  deleteComplaint,
  getComplaintById,
  listComplaints,
  updateComplaint,
  verifyComplaint,
  reopenComplaint
} from '../controllers/complaints.controller.js';
import {
  authenticate,
  requireAdmin,
  requireStaffOrAdmin,
  requireStudent
} from '../middleware/auth.js';

const router = Router();

// Base list & create
router.get('/', authenticate, listComplaints);
router.post('/', authenticate, createComplaint);

// Single issue detail
router.get('/:id', authenticate, getComplaintById);

// Staff/Admin issue update (notes, status transition)
router.patch('/:id', authenticate, requireStaffOrAdmin, updateComplaint);

// Admin-only operations
router.delete('/:id', authenticate, requireAdmin, deleteComplaint);
router.patch('/:id/assign', authenticate, requireAdmin, assignComplaint);

// Student verification & reopening
router.post('/:id/verify', authenticate, requireStudent, verifyComplaint);
router.post('/:id/reopen', authenticate, requireStudent, reopenComplaint);

export default router;
