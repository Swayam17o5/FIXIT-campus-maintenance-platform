export const SLA_HOURS_MAP = {
  critical: 2,
  high: 6,
  medium: 24,
  low: 72
};

export const formatRemainingTime = (ms) => {
  if (ms <= 0) {
    const overdueMs = Math.abs(ms);
    const overdueHours = Math.floor(overdueMs / (1000 * 60 * 60));
    const overdueMins = Math.floor((overdueMs % (1000 * 60 * 60)) / (1000 * 60));
    return `SLA Breached by ${overdueHours}h ${overdueMins}m`;
  }
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h remaining`;
  }
  return `${hours}h ${minutes}m remaining`;
};

export const calculateSLA = (priority, createdAt = new Date()) => {
  const normalizedPriority = String(priority || 'medium').toLowerCase();
  const slaHours = SLA_HOURS_MAP[normalizedPriority] || 24;
  const createdDate = new Date(createdAt);
  const dueDate = new Date(createdDate.getTime() + slaHours * 3600 * 1000);
  const now = new Date();
  const timeRemainingMs = dueDate.getTime() - now.getTime();
  const totalDurationMs = slaHours * 3600 * 1000;
  const elapsedMs = Math.max(0, totalDurationMs - timeRemainingMs);
  const slaPercentage = Math.min(100, Math.max(0, Math.round((elapsedMs / totalDurationMs) * 100)));
  const isBreached = timeRemainingMs < 0;

  return {
    slaHours,
    dueDate: dueDate.toISOString(),
    timeRemainingMs,
    timeRemainingText: formatRemainingTime(timeRemainingMs),
    slaPercentage,
    isBreached
  };
};

export const attachSLAInfo = (complaint) => {
  if (!complaint) return complaint;
  const s = String(complaint.status || 'REPORTED').toUpperCase();
  const isResolvedOrClosed = ['RESOLVED', 'VERIFIED', 'CLOSED', 'resolved', 'closed'].includes(s);

  const startDate = complaint.date_filed || complaint.created_at || new Date();
  const sla = calculateSLA(complaint.priority, startDate);
  const dueDate = complaint.sla_due_date ? new Date(complaint.sla_due_date) : new Date(sla.dueDate);

  if (isResolvedOrClosed) {
    const resolvedDate = complaint.date_resolved ? new Date(complaint.date_resolved) : new Date();
    const wasResolvedWithinSLA = resolvedDate.getTime() <= dueDate.getTime();

    return {
      ...complaint,
      sla_hours: complaint.sla_hours || sla.slaHours,
      sla_due_date: dueDate.toISOString(),
      sla_remaining_ms: 0,
      sla_remaining_text: wasResolvedWithinSLA ? 'Resolved within SLA' : 'SLA Breached',
      sla_percentage: 100,
      is_breached: !wasResolvedWithinSLA,
      resolved_within_sla: wasResolvedWithinSLA
    };
  }

  // Active issues
  const isBreached = sla.isBreached;
  const remainingText = isBreached ? 'SLA Breached' : sla.timeRemainingText;

  return {
    ...complaint,
    sla_hours: complaint.sla_hours || sla.slaHours,
    sla_due_date: dueDate.toISOString(),
    sla_remaining_ms: sla.timeRemainingMs,
    sla_remaining_text: remainingText,
    sla_percentage: sla.slaPercentage,
    is_breached: isBreached,
    resolved_within_sla: false
  };
};
