import { Router } from 'express';
import { listDepartments, createDepartment } from '../controllers/departments.controller.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/', listDepartments);
router.post('/', authenticate, requireRole('admin'), createDepartment);

export default router;
