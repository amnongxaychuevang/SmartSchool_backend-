import { describe, it, expect } from 'vitest';
import { evaluateStudentRisk } from './atRiskAnalytics';

describe('atRiskAnalytics', () => {
  it('identifies student with normal attendance, grades, and behavior as low risk', () => {
    const result = evaluateStudentRisk({
      studentId: 1,
      studentNameEn: 'Somchai Vongsa',
      studentNameLo: 'ສົມຊາຍ ວົງສາ',
      attendance: { totalDays: 30, absentDays: 0, lateDays: 1, consecutiveAbsences: 0 },
      academic: { totalSubjects: 8, failingSubjects: 0, averageScore: 82.5 },
      behavior: { conductScore: 100, demeritCount: 0, severeDemerits: 0 },
    });

    expect(result.riskLevel).toBe('low');
    expect(result.riskScore).toBe(0);
    expect(result.factors.length).toBe(0);
  });

  it('triggers high risk when student has frequent absences and failing grades', () => {
    const result = evaluateStudentRisk({
      studentId: 2,
      studentNameEn: 'Anousone Phomvihane',
      studentNameLo: 'ອານຸສອນ ພົມວິຫານ',
      attendance: { totalDays: 30, absentDays: 6, lateDays: 4, consecutiveAbsences: 3 },
      academic: { totalSubjects: 8, failingSubjects: 2, averageScore: 48.0 },
      behavior: { conductScore: 85, demeritCount: 1, severeDemerits: 0 },
    });

    expect(result.riskLevel).toBe('high');
    expect(result.riskScore).toBeGreaterThanOrEqual(60);
    expect(result.factors.some((f) => f.factor === 'attendance')).toBe(true);
    expect(result.factors.some((f) => f.factor === 'academic')).toBe(true);
  });

  it('triggers medium risk when conduct score drops or 1 subject fails', () => {
    const result = evaluateStudentRisk({
      studentId: 3,
      studentNameEn: 'Mimi Keo',
      studentNameLo: 'ມີມີ້ ແກ້ວ',
      attendance: { totalDays: 30, absentDays: 1, lateDays: 0, consecutiveAbsences: 0 },
      academic: { totalSubjects: 8, failingSubjects: 1, averageScore: 65.0 },
      behavior: { conductScore: 72, demeritCount: 2, severeDemerits: 0 },
    });

    expect(result.riskLevel).toBe('medium');
    expect(result.riskScore).toBeGreaterThanOrEqual(20);
    expect(result.riskScore).toBeLessThan(45);
  });
});
