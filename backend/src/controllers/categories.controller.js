import { supabase } from '../config/db.js';
import asyncHandler from '../utils/asyncHandler.js';

export const listCategories = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('category')
    .select('category_id, name, description')
    .order('name');

  if (error) throw error;
  res.json(data || []);
});

export const getCategoryById = asyncHandler(async (req, res) => {
  const categoryId = Number(req.params.id);
  const { data, error } = await supabase
    .from('category')
    .select('category_id, name, description')
    .eq('category_id', categoryId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ message: 'Category not found' });
  }

  return res.json(data);
});

export const createCategory = asyncHandler(async (req, res) => {
  const { name, description = null } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'name is required' });
  }

  const { data, error } = await supabase
    .from('category')
    .insert([{ name, description }])
    .select('category_id')
    .single();

  if (error) throw error;

  return res.status(201).json({
    message: 'Category created',
    category_id: data.category_id
  });
});

export const updateCategory = asyncHandler(async (req, res) => {
  const categoryId = Number(req.params.id);
  const { name, description } = req.body;

  if (name === undefined && description === undefined) {
    return res.status(400).json({ message: 'At least one field is required' });
  }

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;

  const { data, error } = await supabase
    .from('category')
    .update(updates)
    .eq('category_id', categoryId)
    .select();

  if (error) throw error;
  if (!data || !data.length) {
    return res.status(404).json({ message: 'Category not found' });
  }

  return res.json({ message: 'Category updated' });
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const categoryId = Number(req.params.id);
  const { data, error } = await supabase
    .from('category')
    .delete()
    .eq('category_id', categoryId)
    .select();

  if (error) throw error;
  if (!data || !data.length) {
    return res.status(404).json({ message: 'Category not found' });
  }

  return res.json({ message: 'Category deleted' });
});
