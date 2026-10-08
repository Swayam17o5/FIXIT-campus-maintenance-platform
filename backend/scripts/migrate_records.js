import { supabase } from '../src/config/db.js';
import { calculateSLA } from '../src/utils/sla.js';

const parseEmbeddedLocation = (description) => {
  if (!description) return { cleanDescription: '', metadata: {} };

  const match = description.match(/\[Location:\s*(.*?)\]/s);
  if (!match) {
    return { cleanDescription: description.trim(), metadata: {} };
  }

  const metaStr = match[1];
  const parts = metaStr.split('|').map(s => s.trim());
  const metadata = {};

  for (const p of parts) {
    const [k, ...v] = p.split(':');
    if (k && v.length) {
      const key = k.trim().toLowerCase();
      const val = v.join(':').trim();
      if (key === 'building') metadata.building = val;
      if (key === 'floor') metadata.floor = val;
      if (key === 'room') metadata.room = val;
      if (key === 'landmark') metadata.location_description = val;
      if (key === 'department' || key === 'dept') metadata.department = val;
    }
  }

  const cleanDescription = description.replace(/\s*\[Location:.*?\]/s, '').trim();
  return { cleanDescription, metadata };
};

const mapCanonicalStatus = (status, hasStaff = false) => {
  const s = String(status || '').trim().toLowerCase();
  switch (s) {
    case 'pending':
      return 'REPORTED';
    case 'open':
      return 'UNDER_REVIEW';
    case 'in_progress':
      return hasStaff ? 'IN_PROGRESS' : 'ASSIGNED';
    case 'resolved':
      return 'RESOLVED';
    case 'verified':
      return 'VERIFIED';
    case 'closed':
      return 'CLOSED';
    case 'rejected':
      return 'REJECTED';
    default:
      return String(status).toUpperCase();
  }
};

export const runRecordMigration = async () => {
  console.log('🔄 Checking existing complaints in Supabase...');

  const { data: colsCheck, error: colErr } = await supabase.from('complaint').select('*').limit(1);
  if (colErr) {
    console.error('❌ Failed to connect to complaint table:', colErr.message);
    return;
  }

  const availableCols = new Set(Object.keys(colsCheck[0] || {}));
  console.log('Available columns in complaint table:', Array.from(availableCols));

  const { data: complaints, error: listErr } = await supabase
    .from('complaint')
    .select('*');

  if (listErr) {
    console.error('❌ Failed to fetch complaints:', listErr.message);
    return;
  }

  console.log(`Found ${complaints.length} complaint records to inspect.`);

  let updatedCount = 0;

  for (const c of complaints) {
    const { cleanDescription, metadata } = parseEmbeddedLocation(c.description);
    const canonicalStatus = mapCanonicalStatus(c.status, !!c.staff_id);
    const sla = calculateSLA(c.priority || 'medium', c.date_filed);

    const updates = {};

    // Only update description if it contained embedded metadata
    if (cleanDescription !== c.description) {
      updates.description = cleanDescription;
    }

    // Only set canonical status if it changed
    if (canonicalStatus !== c.status) {
      updates.status = canonicalStatus;
    }

    // Populate native columns if they exist in schema
    if (availableCols.has('building') && (metadata.building || !c.building)) {
      updates.building = metadata.building || c.building || 'Academic Complex';
    }
    if (availableCols.has('floor') && (metadata.floor || !c.floor)) {
      updates.floor = metadata.floor || c.floor || 'Ground Floor';
    }
    if (availableCols.has('room') && (metadata.room || !c.room)) {
      updates.room = metadata.room || c.room || 'General';
    }
    if (availableCols.has('location_description') && metadata.location_description) {
      updates.location_description = metadata.location_description;
    }
    if (availableCols.has('department') && (metadata.department || !c.department)) {
      updates.department = metadata.department || c.department || 'Maintenance';
    }
    if (availableCols.has('sla_hours') && !c.sla_hours) {
      updates.sla_hours = sla.slaHours;
    }
    if (availableCols.has('sla_due_date') && !c.sla_due_date) {
      updates.sla_due_date = sla.dueDate;
    }

    if (Object.keys(updates).length > 0) {
      let { error: updErr } = await supabase
        .from('complaint')
        .update(updates)
        .eq('complaint_id', c.complaint_id);

      if (updErr && updErr.code === '23514') {
        // Fallback: don't change status until user runs migration_phase1_canonical.sql
        delete updates.status;
        if (Object.keys(updates).length > 0) {
          const fallbackRes = await supabase
            .from('complaint')
            .update(updates)
            .eq('complaint_id', c.complaint_id);
          updErr = fallbackRes.error;
        } else {
          updErr = null;
        }
      }

      if (updErr) {
        console.warn(`⚠️ Warning updating complaint #${c.complaint_id}:`, updErr.message);
      } else {
        updatedCount++;
        console.log(`✅ Cleaned description & migrated complaint #${c.complaint_id}`);
      }
    }
  }

  console.log(`🎉 Record migration completed: ${updatedCount} records updated.`);
};

// Allow direct execution
if (process.argv[1]?.endsWith('migrate_records.js')) {
  runRecordMigration().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
  });
}
