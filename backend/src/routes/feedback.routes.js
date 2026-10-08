import { Router } from 'express';
import {
  createFeedback,
  getFeedbackByComplaint
} from '../controllers/feedback.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/', authenticate, createFeedback);
router.get('/complaint/:complaintId', authenticate, getFeedbackByComplaint);

export default router;
