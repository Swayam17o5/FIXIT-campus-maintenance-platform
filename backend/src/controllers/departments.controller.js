import { supabase } from '../config/db.js';
import asyncHandler from '../utils/asyncHandler.js';

const DEFAULT_DEPARTMENTS = [
  { department_id: 1, name: 'Maintenance', description: 'General campus upkeep and facility repair', sla_default_hours: 24 },
  { department_id: 2, name: 'Electrical Engineering', description: 'Power, wiring, generators, and electronics', sla_default_hours: 12 },
  { department_id: 3, name: 'Plumbing & Sanitation', description: 'Water supply, plumbing fittings, and drainage', sla_default_hours: 12 },
  { department_id: 4, name: 'IT Infrastructure', description: 'Networking, computers, smart boards, and servers', sla_default_hours: 6 },
  { department_id: 5, name: 'Civil & Infrastructure', description: 'Building structures, carpentry, and masonry', sla_default_hours: 48 },
  { department_id: 6, name: 'Hostel Administration', description: 'Hostel accommodation, mess, and amenities', sla_default_hours: 24 },
  { department_id: 7, name: 'Campus Security', description: 'Gate control, surveillance, and emergency safety', sla_default_hours: 2 }
];

export const listDepartments = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('department')
    .select('department_id, name, description, sla_default_hours')
    .order('name');

  if (error) {
    return res.json(DEFAULT_DEPARTMENTS);
  }
  res.json(data || DEFAULT_DEPARTMENTS);
});

export const createDepartment = asyncHandler(async (req, res) => {
  const { name, description = null, sla_default_hours = 24 } = req.body;

  if (!name) {
    return res.status(400).json({ message: 'Department name is required' });
  }

  const { data, error } = await supabase
    .from('department')
    .insert([{ name, description, sla_default_hours: Number(sla_default_hours) || 24 }])
    .select('department_id')
    .single();

  if (error) throw error;
  return res.status(201).json({
    message: 'Department created',
    department_id: data.department_id
  });
});
