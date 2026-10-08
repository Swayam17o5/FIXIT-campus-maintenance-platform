import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabase } from '../config/db.js';
import env from '../config/env.js';
import asyncHandler from '../utils/asyncHandler.js';
import { attachSLAInfo } from '../utils/sla.js';
import { getSupportedColumns } from './complaints.controller.js';

const signStudentToken = (student) => {
  return jwt.sign(
    {
      id: student.student_id,
      studentId: student.student_id,
      name: student.name,
      email: student.email,
      role: 'student'
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn }
  );
};

export const registerStudent = asyncHandler(async (req, res) => {
  const { name, email, phone = null, department = null, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'name, email, and password are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const { data: existing, error: checkError } = await supabase
    .from('student')
    .select('student_id')
    .eq('email', normalizedEmail);

  if (checkError) throw checkError;
  if (existing && existing.length > 0) {
    return res.status(409).json({ message: 'Email is already registered' });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const { data: student, error: insertError } = await supabase
    .from('student')
    .insert([{
      name,
      email: normalizedEmail,
      phone,
      department,
      password_hash: passwordHash
    }])
    .select('student_id, name, email, phone, department')
    .single();

  if (insertError) throw insertError;

  return res.status(201).json({
    message: 'Student registered successfully',
    student,
    token: signStudentToken(student)
  });
});

export const loginStudent = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'email and password are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  const { data: student, error } = await supabase
    .from('student')
    .select('student_id, name, email, phone, department, password_hash')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (error) throw error;
  if (!student) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const isPasswordValid = await bcrypt.compare(password, student.password_hash);
  if (!isPasswordValid) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  return res.json({
    message: 'Login successful',
    student: {
      student_id: student.student_id,
      name: student.name,
      email: student.email,
      phone: student.phone,
      department: student.department
    },
    token: signStudentToken(student)
  });
});

export const getStudentById = asyncHandler(async (req, res) => {
  const studentId = Number(req.params.id);

  const { data: student, error } = await supabase
    .from('student')
    .select('student_id, name, email, phone, department, created_at')
    .eq('student_id', studentId)
    .maybeSingle();

  if (error) throw error;
  if (!student) {
    return res.status(404).json({ message: 'Student not found' });
  }

  return res.json(student);
});

export const getStudentComplaints = asyncHandler(async (req, res) => {
  const studentId = Number(req.params.id);
  const user = req.user;

  // RBAC: Verify student only accesses their own complaints
  if (user && user.role === 'student' && user.id !== studentId) {
    return res.status(403).json({
      message: "Forbidden: You do not have permission to access another student's issues."
    });
  }

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
      date_resolved,
      category:category_id (name),
      staff:staff_id (name)
    `
    : `
      complaint_id,
      title,
      description,
      status,
      priority,
      date_filed,
      date_resolved,
      category:category_id (name),
      staff:staff_id (name)
    `;

  const { data, error } = await supabase
    .from('complaint')
    .select(selectCols)
    .eq('student_id', studentId)
    .order('date_filed', { ascending: false });

  if (error) throw error;

  const mapped = (data || []).map((c) => {
    const normalized = {
      ...c,
      building: c.building || 'Academic Complex',
      floor: c.floor || 'Ground Floor',
      room: c.room || 'General'
    };
    const withSla = attachSLAInfo(normalized);
    return {
      ...withSla,
      category: c.category?.name || 'General',
      assigned_staff: c.staff?.name || 'Unassigned'
    };
  });

  return res.json(mapped);
});

export const updateStudent = asyncHandler(async (req, res) => {
  const studentId = Number(req.params.id);
  const { name, phone, department } = req.body;

  if (name === undefined && phone === undefined && department === undefined) {
    return res.status(400).json({ message: 'At least one field is required' });
  }

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (phone !== undefined) updates.phone = phone;
  if (department !== undefined) updates.department = department;

  const { data, error } = await supabase
    .from('student')
    .update(updates)
    .eq('student_id', studentId)
    .select();

  if (error) throw error;
  if (!data || !data.length) {
    return res.status(404).json({ message: 'Student not found' });
  }

  return res.json({ message: 'Student updated' });
});
