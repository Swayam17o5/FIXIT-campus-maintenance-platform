import { Router } from 'express';
import {
  getStudentById,
  getStudentComplaints,
  loginStudent,
  registerStudent,
  updateStudent
} from '../controllers/students.controller.js';
import { authenticate, requireStudent } from '../middleware/auth.js';

const router = Router();

router.post('/register', registerStudent);
router.post('/login', loginStudent);
router.get('/:id', authenticate, requireStudent, getStudentById);
router.patch('/:id', authenticate, requireStudent, updateStudent);
router.get('/:id/complaints', authenticate, requireStudent, getStudentComplaints);

export default router;
