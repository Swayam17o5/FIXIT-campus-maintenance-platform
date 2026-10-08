import { Router } from 'express';
import {
  createCategory,
  deleteCategory,
  getCategoryById,
  listCategories,
  updateCategory
} from '../controllers/categories.controller.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// Public list & detail
router.get('/', listCategories);
router.get('/:id', getCategoryById);

// Admin-only management
router.post('/', authenticate, requireAdmin, createCategory);
router.patch('/:id', authenticate, requireAdmin, updateCategory);
router.delete('/:id', authenticate, requireAdmin, deleteCategory);

export default router;
