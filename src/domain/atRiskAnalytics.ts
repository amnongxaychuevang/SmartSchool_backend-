export interface AttendanceMetrics {
  totalDays: number;
  absentDays: number;
  lateDays: number;
  consecutiveAbsences: number;
}

export interface AcademicMetrics {
  totalSubjects: number;
  failingSubjects: number;
  averageScore: number;
}

export interface BehaviorMetrics {
  conductScore: number;
  demeritCount: number;
  severeDemerits: number;
}

export interface StudentRiskInput {
  studentId: number;
  studentNameEn: string;
  studentNameLo: string;
  attendance: AttendanceMetrics;
  academic: AcademicMetrics;
  behavior: BehaviorMetrics;
}

export type RiskLevel = 'low' | 'medium' | 'high';

export interface RiskFactorDetail {
  factor: 'attendance' | 'academic' | 'behavior';
  severity: 'low' | 'medium' | 'high';
  score: number;
  messageEn: string;
  messageLo: string;
}

export interface RiskEvaluationResult {
  studentId: number;
  studentNameEn: string;
  studentNameLo: string;
  riskScore: number;
  riskLevel: RiskLevel;
  attendanceScore: number;
  academicScore: number;
  behaviorScore: number;
  factors: RiskFactorDetail[];
}

export function evaluateStudentRisk(input: StudentRiskInput): RiskEvaluationResult {
  const factors: RiskFactorDetail[] = [];
  let attendanceScore = 0;
  let academicScore = 0;
  let behaviorScore = 0;

  // 1. Evaluate Attendance Risk
  const { absentDays, consecutiveAbsences, totalDays } = input.attendance;
  if (consecutiveAbsences >= 3) {
    attendanceScore += 25;
    factors.push({
      factor: 'attendance',
      severity: 'high',
      score: 25,
      messageEn: `Absent for ${consecutiveAbsences} consecutive days`,
      messageLo: `ຂາດຮຽນຕິດຕໍ່ກັນ ${consecutiveAbsences} ມື້`,
    });
  } else if (absentDays >= 5) {
    attendanceScore += 20;
    factors.push({
      factor: 'attendance',
      severity: 'medium',
      score: 20,
      messageEn: `High absence rate: ${absentDays} days absent`,
      messageLo: `ຂາດຮຽນຫຼາຍ: ${absentDays} ມື້`,
    });
  } else if (absentDays >= 3) {
    attendanceScore += 10;
    factors.push({
      factor: 'attendance',
      severity: 'low',
      score: 10,
      messageEn: `Moderate absence: ${absentDays} days absent`,
      messageLo: `ຂາດຮຽນປານກາງ: ${absentDays} ມື້`,
    });
  }

  // 2. Evaluate Academic Risk
  const { failingSubjects, averageScore, totalSubjects } = input.academic;
  if (failingSubjects >= 2) {
    academicScore += 35;
    factors.push({
      factor: 'academic',
      severity: 'high',
      score: 35,
      messageEn: `Failing in ${failingSubjects} subjects`,
      messageLo: `ສອບເສັງບໍ່ຜ່ານ ${failingSubjects} ວິຊາ`,
    });
  } else if (failingSubjects === 1) {
    academicScore += 18;
    factors.push({
      factor: 'academic',
      severity: 'medium',
      score: 18,
      messageEn: `Failing in 1 subject`,
      messageLo: `ສອບເສັງບໍ່ຜ່ານ 1 ວິຊາ`,
    });
  }

  if (totalSubjects > 0 && averageScore > 0 && averageScore < 50) {
    academicScore += 15;
    factors.push({
      factor: 'academic',
      severity: 'medium',
      score: 15,
      messageEn: `Low average grade (${averageScore.toFixed(1)}%)`,
      messageLo: `ຄະແນນສະເລ່ຍຕ່ຳ (${averageScore.toFixed(1)}%)`,
    });
  }

  // 3. Evaluate Behavior / Discipline Risk
  const { conductScore, severeDemerits } = input.behavior;
  if (conductScore < 60 || severeDemerits >= 2) {
    behaviorScore += 30;
    factors.push({
      factor: 'behavior',
      severity: 'high',
      score: 30,
      messageEn: `Critical conduct score (${conductScore}/100)`,
      messageLo: `ຄະແນນຄວາມປະພຶດວິກິດ (${conductScore}/100)`,
    });
  } else if (conductScore < 75 || severeDemerits === 1) {
    behaviorScore += 15;
    factors.push({
      factor: 'behavior',
      severity: 'medium',
      score: 15,
      messageEn: `Conduct score warning (${conductScore}/100)`,
      messageLo: `ຄະແນນຄວາມປະພຶດເຕືອນໄພ (${conductScore}/100)`,
    });
  }

  const rawScore = attendanceScore + academicScore + behaviorScore;
  const riskScore = Math.min(100, Math.max(0, rawScore));

  let riskLevel: RiskLevel = 'low';
  if (riskScore >= 45) {
    riskLevel = 'high';
  } else if (riskScore >= 20) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  return {
    studentId: input.studentId,
    studentNameEn: input.studentNameEn,
    studentNameLo: input.studentNameLo,
    riskScore,
    riskLevel,
    attendanceScore,
    academicScore,
    behaviorScore,
    factors,
  };
}
