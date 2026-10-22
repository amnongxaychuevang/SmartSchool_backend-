/**
 * Pure domain logic and calculations for teacher payroll.
 */

export interface PayrollItemInput {
  baseSalary: number;
  teachingAllowance?: number;
  attendanceBonus?: number;
  otherAllowance?: number;
  absenceDeduction?: number;
  taxDeduction?: number;
  otherDeduction?: number;
}

export function calculateNetSalary(item: PayrollItemInput): number {
  const base = Math.max(0, Number(item.baseSalary) || 0);
  const teaching = Math.max(0, Number(item.teachingAllowance) || 0);
  const attendance = Math.max(0, Number(item.attendanceBonus) || 0);
  const otherAllow = Math.max(0, Number(item.otherAllowance) || 0);

  const absence = Math.max(0, Number(item.absenceDeduction) || 0);
  const tax = Math.max(0, Number(item.taxDeduction) || 0);
  const otherDed = Math.max(0, Number(item.otherDeduction) || 0);

  const grossEarnings = base + teaching + attendance + otherAllow;
  const totalDeductions = absence + tax + otherDed;

  return Math.max(0, grossEarnings - totalDeductions);
}

const LAO_MONTHS = [
  'ມັງກອນ', 'ກຸມພາ', 'ມີນາ', 'ເມສາ', 'ພຶດສະພາ', 'ມິຖຸນາ',
  'ກໍລະກົດ', 'ສິງຫາ', 'ກັນຍາ', 'ຕຸລາ', 'ພະຈິກ', 'ທັນວາ'
];

const EN_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function formatPeriodName(periodMonth: string): { nameEn: string; nameLo: string } {
  const [yearStr, monthStr] = periodMonth.split('-');
  const year = parseInt(yearStr || '2026', 10);
  const monthIdx = parseInt(monthStr || '1', 10) - 1;

  const validIdx = Math.max(0, Math.min(monthIdx, 11));
  const enMonth = EN_MONTHS[validIdx];
  const loMonth = LAO_MONTHS[validIdx];

  return {
    nameEn: `${enMonth} ${year}`,
    nameLo: `${loMonth} ${year}`,
  };
}

export function getMonthDateRange(periodMonth: string): { startDate: Date; endDate: Date } {
  const [yearStr, monthStr] = periodMonth.split('-');
  const year = parseInt(yearStr || '2026', 10);
  const month = parseInt(monthStr || '1', 10);

  const startDate = new Date(Date.UTC(year, month - 1, 1));
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

  return { startDate, endDate };
}
