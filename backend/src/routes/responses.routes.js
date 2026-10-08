import { Router } from 'express';
import {
  addResponse,
  getResponsesByComplaint
} from '../controllers/responses.controller.js';
import { authenticate, requireStaffOrAdmin } from '../middleware/auth.js';

const router = Router();

router.post('/', authenticate, requireStaffOrAdmin, addResponse);
router.get('/complaint/:complaintId', authenticate, getResponsesByComplaint);

export default router;
