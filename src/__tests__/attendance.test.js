import { describe, it, expect } from 'vitest'

// Pure attendance calculation function matching Learnova telemetry
export function calculateAttendanceScore(attendanceLogs = [], minDurationSeconds = 60) {
  if (!attendanceLogs || attendanceLogs.length === 0) return 85;
  const validAttended = attendanceLogs.filter(
    log => log.attendance_status === 'present' && (log.duration_seconds || 0) >= minDurationSeconds
  ).length;
  return Math.min(100, Math.round((validAttended / attendanceLogs.length) * 100));
}

describe('Attendance Duration & Score Calculation', () => {
  it('calculates 100% when all live sessions meet duration threshold', () => {
    const logs = [
      { attendance_status: 'present', duration_seconds: 3600 },
      { attendance_status: 'present', duration_seconds: 2400 }
    ];
    expect(calculateAttendanceScore(logs)).toBe(100);
  });

  it('filters out sessions below minimum required attendance duration', () => {
    const logs = [
      { attendance_status: 'present', duration_seconds: 3600 },
      { attendance_status: 'present', duration_seconds: 30 }, // below 60s
      { attendance_status: 'absent', duration_seconds: 0 }
    ];
    expect(calculateAttendanceScore(logs, 60)).toBe(33);
  });

  it('returns default fallback score when no logs are recorded', () => {
    expect(calculateAttendanceScore([])).toBe(85);
  });
});
