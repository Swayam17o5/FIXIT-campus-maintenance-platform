export const getStatusBadgeVariant = (status?: string) => {
  if (!status) return 'secondary';
  switch (status.toUpperCase()) {
    case 'VERIFIED':
    case 'CLOSED':
    case 'RESOLVED':
      return 'success';
    case 'IN_PROGRESS':
      return 'warning';
    case 'ASSIGNED':
    case 'UNDER_REVIEW':
      return 'secondary';
    case 'REJECTED':
      return 'destructive';
    case 'REPORTED':
    default:
      return 'outline';
  }
};

export const getPriorityBadgeVariant = (priority?: string) => {
  if (!priority) return 'secondary';
  switch (priority.toLowerCase()) {
    case 'critical':
      return 'destructive';
    case 'high':
      return 'warning';
    case 'medium':
      return 'secondary';
    case 'low':
    default:
      return 'outline';
  }
};

export const formatStatus = (status?: string) => {
  if (!status) return 'Reported';
  return status
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
};

export const LIFECYCLE_STEPS = [
  { key: 'REPORTED', label: 'Reported' },
  { key: 'UNDER_REVIEW', label: 'Under Review' },
  { key: 'ASSIGNED', label: 'Assigned' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'RESOLVED', label: 'Resolved' },
  { key: 'VERIFIED', label: 'Verified' },
  { key: 'CLOSED', label: 'Closed' }
];

export const getLifecycleStepIndex = (status?: string) => {
  if (!status) return 0;
  const s = status.toUpperCase();
  if (s === 'PENDING') return 0;
  if (s === 'OPEN') return 1;
  const idx = LIFECYCLE_STEPS.findIndex((step) => step.key === s);
  return idx >= 0 ? idx : 0;
};
