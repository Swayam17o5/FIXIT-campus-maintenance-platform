export const CANONICAL_STATUSES = [
  'REPORTED',
  'UNDER_REVIEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'VERIFIED',
  'CLOSED',
  'REJECTED'
];

export const ALLOWED_TRANSITIONS = {
  REPORTED: ['UNDER_REVIEW', 'ASSIGNED', 'REJECTED'],
  UNDER_REVIEW: ['ASSIGNED', 'IN_PROGRESS', 'REJECTED'],
  ASSIGNED: ['IN_PROGRESS', 'RESOLVED', 'UNDER_REVIEW'],
  IN_PROGRESS: ['RESOLVED', 'ASSIGNED'],
  RESOLVED: ['VERIFIED', 'IN_PROGRESS', 'CLOSED'],
  VERIFIED: ['CLOSED'],
  CLOSED: [],
  REJECTED: ['UNDER_REVIEW']
};

export const normalizeStatus = (status) => {
  if (!status) return 'REPORTED';
  const s = String(status).trim().toUpperCase();

  // Legacy mappings for database backwards-compatibility during migration
  if (s === 'PENDING') return 'REPORTED';
  if (s === 'OPEN') return 'UNDER_REVIEW';

  return s;
};

export const isValidStatus = (status) => {
  const normalized = normalizeStatus(status);
  return CANONICAL_STATUSES.includes(normalized);
};

export const canTransition = (currentStatus, targetStatus) => {
  const current = normalizeStatus(currentStatus);
  const target = normalizeStatus(targetStatus);

  if (current === target) return true;

  const allowed = ALLOWED_TRANSITIONS[current] || [];
  return allowed.includes(target);
};

export const validateTransition = (currentStatus, targetStatus, options = {}) => {
  const current = normalizeStatus(currentStatus);
  const target = normalizeStatus(targetStatus);

  if (!isValidStatus(target)) {
    return {
      valid: false,
      message: `Invalid lifecycle status '${targetStatus}'. Must be one of: ${CANONICAL_STATUSES.join(', ')}`
    };
  }

  if (!canTransition(current, target)) {
    const allowed = ALLOWED_TRANSITIONS[current] || [];
    return {
      valid: false,
      message: `Invalid state transition from '${current}' to '${target}'. Allowed transitions: ${allowed.length ? allowed.join(', ') : 'None (Terminal state)'}`
    };
  }

  if (target === 'REJECTED' && !options.rejection_reason) {
    return {
      valid: false,
      message: 'A rejection reason is required when rejecting an issue'
    };
  }

  if (target === 'RESOLVED' && !options.resolution_notes) {
    return {
      valid: false,
      message: 'Resolution notes are required when marking an issue as resolved'
    };
  }

  return { valid: true };
};
