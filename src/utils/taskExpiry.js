/**
 * Task Expiry Utilities for VIBE Platform
 * 
 * Determines whether a task submission deadline has passed, handling
 * both date-only deadlines and exact timestamps consistently.
 */

export const getTaskDeadlineTs = (task) => {
  if (!task) return Infinity;
  const rawDate = task.lastDateToSubmit || task.deadlineRaw || task.deadline;
  if (!rawDate) return Infinity;

  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return Infinity;

  // If date-only string (e.g. "2026-10-27") or stored with midnight 00:00:00.000Z,
  // the deadline remains valid until the end of that day (23:59:59.999).
  const isMidnight =
    (typeof rawDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawDate.trim())) ||
    (d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0 && d.getUTCMilliseconds() === 0);

  if (isMidnight) {
    const endOfDay = new Date(d);
    endOfDay.setHours(23, 59, 59, 999);
    return endOfDay.getTime();
  }

  return d.getTime();
};

export const isTaskExpired = (task) => {
  const ts = getTaskDeadlineTs(task);
  if (ts === Infinity) return false;
  return Date.now() > ts;
};

export default {
  getTaskDeadlineTs,
  isTaskExpired,
};
