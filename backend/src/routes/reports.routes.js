import { Router } from 'express';
import {
  averageResolutionTime,
  complaintsByCategory,
  complaintsByDepartment,
  complaintsByStatus,
  issuesByLocation,
  openComplaintsDashboard,
  operationsDashboard,
  staffPerformance
} from '../controllers/reports.controller.js';
import { authenticate, requireStaffOrAdmin } from '../middleware/auth.js';

const router = Router();

// Operations & Analytics reports (Staff & Admin only)
router.use(authenticate, requireStaffOrAdmin);

router.get('/operations-dashboard', operationsDashboard);
router.get('/complaints-by-status', complaintsByStatus);
router.get('/complaints-by-category', complaintsByCategory);
router.get('/complaints-by-department', complaintsByDepartment);
router.get('/issues-by-location', issuesByLocation);
router.get('/staff-performance', staffPerformance);
router.get('/average-resolution-time', averageResolutionTime);
router.get('/open-complaints-dashboard', openComplaintsDashboard);

export default router;
