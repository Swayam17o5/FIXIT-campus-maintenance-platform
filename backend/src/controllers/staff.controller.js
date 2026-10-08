import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/db.js';
import env from '../config/env.js';
import asyncHandler from '../utils/asyncHandler.js';
import { attachSLAInfo } from '../utils/sla.js';
import { getSupportedColumns } from './complaints.controller.js';

const VALID_STAFF_ROLES = ['admin', 'staff'];

const signStaffToken = (staff) => {
  return jwt.sign(
    {
      id: staff.staff_id,
      staffId: staff.staff_id,
      name: staff.name,
      email: staff.email,
      role: staff.role
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

export const registerStaff = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    phone = null,
    department = null,
    password,
    role = 'staff'
  } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'name, email, and password are required' });
  }

  if (!VALID_STAFF_ROLES.includes(role)) {
    return res.status(400).json({ message: 'Invalid role value' });
  }

  const normalizedEmail = normalizeEmail(email);

  const { data: existing, error: checkError } = await supabase
    .from('staff')
    .select('staff_id')
    .eq('email', normalizedEmail);

  if (checkError) throw checkError;
  if (existing && existing.length > 0) {
    return res.status(409).json({ message: 'Email is already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const { data: staff, error: insertError } = await supabase
    .from('staff')
    .insert([{
      name,
      email: normalizedEmail,
      phone,
      department,
      password_hash: passwordHash,
      role
    }])
    .select('staff_id, name, email, phone, department, role')
    .single();

  if (insertError) throw insertError;

  return res.status(201).json({
    message: 'Staff registered successfully',
    staff,
    token: signStaffToken(staff)
  });
});

export const loginStaff = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' });
  }

  const normalizedEmail = normalizeEmail(email);

  const { data: staff, error } = await supabase
    .from('staff')
    .select('staff_id, name, email, phone, department, role, password_hash')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error) throw error;
  if (!staff || !staff.password_hash) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const isPasswordValid = await bcrypt.compare(password, staff.password_hash);
  if (!isPasswordValid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  return res.json({
    message: 'Login successful',
    staff: {
      staff_id: staff.staff_id,
      name: staff.name,
      email: staff.email,
      phone: staff.phone,
      department: staff.department,
      role: staff.role
    },
    token: signStaffToken(staff)
  });
});

export const listStaff = asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('staff')
    .select('staff_id, name, email, phone, department, role, created_at')
    .order('name');

  if (error) throw error;
  res.json(data || []);
});

export const getStaffById = asyncHandler(async (req, res) => {
  const staffId = Number(req.params.id);

  const { data: staff, error } = await supabase
    .from('staff')
    .select('staff_id, name, email, phone, department, role, created_at')
    .eq('staff_id', staffId)
    .maybeSingle();

  if (error) throw error;
  if (!staff) {
    return res.status(404).json({ message: 'Staff not found' });
  }

  return res.json(staff);
});

export const createStaff = asyncHandler(async (req, res) => {
  const {
    name,
    email,
    phone = null,
    department = null,
    role = 'staff',
    password
  } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'name, email, and password are required' });
  }

  if (!VALID_STAFF_ROLES.includes(role)) {
    return res.status(400).json({ message: 'Invalid role value' });
  }

  const normalizedEmail = normalizeEmail(email);

  const { data: existing, error: checkError } = await supabase
    .from('staff')
    .select('staff_id')
    .eq('email', normalizedEmail);

  if (checkError) throw checkError;
  if (existing && existing.length > 0) {
    return res.status(409).json({ message: 'Email is already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const { data: staff, error: insertError } = await supabase
    .from('staff')
    .insert([{
      name,
      email: normalizedEmail,
      phone,
      department,
      password_hash: passwordHash,
      role
    }])
    .select('staff_id, name, email, phone, department, role')
    .single();

  if (insertError) throw insertError;

  return res.status(201).json({
    message: 'Staff created',
    staff_id: staff.staff_id
  });
});

export const updateStaff = asyncHandler(async (req, res) => {
  const staffId = Number(req.params.id);
  const { name, email, phone, department, role, password } = req.body;

  if (
    name === undefined &&
    email === undefined &&
    phone === undefined &&
    department === undefined &&
    role === undefined &&
    password === undefined
  ) {
    return res.status(400).json({ message: 'At least one field is required' });
  }

  if (role !== undefined && !VALID_STAFF_ROLES.includes(role)) {
    return res.status(400).json({ message: 'Invalid role value' });
  }

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = normalizeEmail(email);
  if (phone !== undefined) updates.phone = phone;
  if (department !== undefined) updates.department = department;
  if (role !== undefined) updates.role = role;
  if (password !== undefined) {
    updates.password_hash = await bcrypt.hash(password, 10);
  }

  const { data, error } = await supabase
    .from('staff')
    .update(updates)
    .eq('staff_id', staffId)
    .select();

  if (error) throw error;
  if (!data || !data.length) {
    return res.status(404).json({ message: 'Staff not found' });
  }

  return res.json({ message: 'Staff updated' });
});

export const deleteStaff = asyncHandler(async (req, res) => {
  const staffId = Number(req.params.id);

  const { data, error } = await supabase
    .from('staff')
    .delete()
    .eq('staff_id', staffId)
    .select();

  if (error) throw error;
  if (!data || !data.length) {
    return res.status(404).json({ message: 'Staff not found' });
  }

  return res.json({ message: 'Staff deleted' });
});

export const getAssignedComplaintsByStaff = asyncHandler(async (req, res) => {
  const staffId = Number(req.params.id);
  const user = req.user;

  // RBAC: Staff can only view their own assigned complaints; Admin can view any
  if (user && user.role === 'staff' && user.id !== staffId) {
    return res.status(403).json({
      message: 'Forbidden: Staff members can only view their own assigned issues.'
    });
  }

  const { status, priority, category_id, breached } = req.query;

  const cols = await getSupportedColumns();
  const selectCols = cols.has('building')
    ? `
      complaint_id,
      title,
      description,
      status,
      priority,
      building,
      floor,
      room,
      location_description,
      department,
      sla_hours,
      sla_due_date,
      date_filed,
      assigned_at,
      date_resolved,
      student_id,
      student:student_id (name, email),
      category:category_id (name)
    `
    : `
      complaint_id,
      title,
      description,
      status,
      priority,
      date_filed,
      date_resolved,
      student_id,
      student:student_id (name, email),
      category:category_id (name)
    `;

  let queryBuilder = supabase
    .from('complaint')
    .select(selectCols)
    .eq('staff_id', staffId);

  if (status) {
    queryBuilder = queryBuilder.ilike('status', String(status).toUpperCase());
  }
  if (priority) {
    queryBuilder = queryBuilder.eq('priority', String(priority).toLowerCase());
  }
  if (category_id) {
    queryBuilder = queryBuilder.eq('category_id', Number(category_id));
  }

  const { data, error } = await queryBuilder.order('date_filed', { ascending: false });

  if (error) throw error;

  let mapped = (data || []).map((c) => {
    const normalized = {
      ...c,
      building: c.building || 'Academic Complex',
      floor: c.floor || 'Ground Floor',
      room: c.room || 'General'
    };
    const withSla = attachSLAInfo(normalized);
    return {
      ...withSla,
      student_name: c.student?.name || 'Unknown',
      category: c.category?.name || 'General'
    };
  });

  if (breached === 'true') {
    mapped = mapped.filter((item) => item.is_breached);
  } else if (breached === 'false') {
    mapped = mapped.filter((item) => !item.is_breached);
  }

  return res.json(mapped);
});
