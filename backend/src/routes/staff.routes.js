import { Router } from 'express';
import {
  createStaff,
  deleteStaff,
  getAssignedComplaintsByStaff,
  getStaffById,
  loginStaff,
  listStaff,
  registerStaff,
  updateStaff
} from '../controllers/staff.controller.js';
import { authenticate, requireAdmin, requireStaffOrAdmin } from '../middleware/auth.js';

const router = Router();

// Public auth routes
router.post('/register', registerStaff);
router.post('/login', loginStaff);

// Protected staff directory
router.get('/', authenticate, listStaff);
router.get('/:id', authenticate, getStaffById);
router.get('/:id/complaints', authenticate, requireStaffOrAdmin, getAssignedComplaintsByStaff);

// Admin-only staff management
router.post('/', authenticate, requireAdmin, createStaff);
router.patch('/:id', authenticate, requireAdmin, updateStaff);
router.delete('/:id', authenticate, requireAdmin, deleteStaff);

export default router;
