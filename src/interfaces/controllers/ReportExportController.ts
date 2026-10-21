import prisma from '../../infrastructure/database/PrismaClient';
import schoolReportRepository from '../../infrastructure/repositories/SchoolReportRepository';
import feeRepository from '../../infrastructure/repositories/FeeRepository';
import walletRepository from '../../infrastructure/repositories/WalletRepository';
import auditLogRepository from '../../infrastructure/repositories/AuditLogRepository';
import GetAttendanceReport from '../../application/use-cases/reports/GetAttendanceReport';
import { getCurrentAcademicYear } from '../../infrastructure/repositories/AcademicYear';
import { buildWorkbook, sendWorkbook, exportLang, type ExportColumn, type ExportLang } from '../../infrastructure/export/excel';
import { schoolDateString } from '../../domain/schoolTime';

// Report exports follow the same standard as list exports (see ExportController):
// the report's own data and filters, bilingual headers, one audit-log entry per export.

const MAX_ROWS = 20000;
const num = (v: unknown) => Number(v ?? 0);
const pick = (lang: ExportLang, lo?: string | null, en?: string | null) => (lang === 'lo' ? lo || en : en || lo) || '';
const date = (d?: Date | null) => (d ? schoolDateString(d) : '');
const time = (d: Date) => new Date(d.getTime() + 7 * 3600e3).toISOString().slice(11, 16); // school clock HH:MM
const L = (lo: string, en: string) => ({ lo, en });
const ATT_STATUS: Record<string, { lo: string; en: string }> = {
  absent: L('ຂາດຮຽນ', 'Absent'), excused: L('ລາພັກ', 'Excused'), unrecorded: L('ບໍ່ມີບັນທຶກ', 'Unrecorded'),
};
const METHOD = { cash: L('ເງິນສົດ', 'Cash'), bank_transfer: L('ໂອນ', 'Transfer') } as const;
const getAttendanceReport = new GetAttendanceReport();

async function send(req, res, opts: { report: string; file: string; sheet: { lo: string; en: string }; columns: ExportColumn<any>[]; rows: any[]; lang: ExportLang }) {
  if (opts.rows.length > MAX_ROWS) throw Object.assign(new Error(`Too many rows to export (over ${MAX_ROWS})`), { statusCode: 413 });
  await auditLogRepository.log({
    userId: req.user.userId,
    action: 'export',
    entityType: 'report',
    entityId: opts.report,
    detail: { rows: opts.rows.length, query: { ...req.query, lang: undefined } },
    ipAddress: req.ip,
  });
  sendWorkbook(res, opts.file, buildWorkbook(opts.sheet[opts.lang], opts.columns, opts.rows, opts.lang));
}

class ReportExportController {
  // GET /reports/attendance/export?range=
  async attendance(req, res, next) {
    try {
      const lang = exportLang(req);
      const range = ['today', '7d', '30d'].includes(req.query.range) ? req.query.range : 'today';
      const report = await getAttendanceReport.execute(range, MAX_ROWS + 1);
      await send(req, res, {
        report: 'attendance', file: `attendance-${range}`, sheet: L('ຂາດຮຽນ', 'Absences'), lang, rows: report.absentees,
        columns: [
          { header: L('ລະຫັດນັກຮຽນ', 'Student code'), value: (a) => a.studentCode, width: 16 },
          { header: L('ນັກຮຽນ', 'Student'), value: (a) => pick(lang, a.fullNameLo, a.fullNameEn), width: 26 },
          { header: L('ຫ້ອງຮຽນ', 'Class'), value: (a) => pick(lang, a.classNameLo, a.classNameEn), width: 10 },
          { header: L('ວັນທີ', 'Date'), value: (a) => a.date, width: 12 },
          { header: L('ສະຖານະ', 'Status'), value: (a) => ATT_STATUS[a.status]?.[lang] ?? a.status, width: 12 },
          { header: L('ເຫດຜົນ', 'Reason'), value: (a) => a.leaveReason, width: 28 },
          { header: L('ແຈ້ງຜູ້ປົກຄອງ', 'Parent notice'), value: (a) => a.notification, width: 14 },
        ],
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /reports/grades/export?search=&published=true|false&gradeMonth=YYYY-MM
  async grades(req, res, next) {
    try {
      const lang = exportLang(req);
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      const rows = await prisma.grade.findMany({
        where: {
          ...(req.query.published === 'true' ? { isPublished: true } : req.query.published === 'false' ? { isPublished: false } : {}),
          ...(/^\d{4}-\d{2}$/.test(req.query.gradeMonth ?? '') ? { gradeMonth: req.query.gradeMonth } : {}),
          ...(search ? { student: { OR: [{ studentCode: { contains: search } }, { fullNameEn: { contains: search } }, { fullNameLo: { contains: search } }] } } : {}),
        },
        orderBy: { recordedAt: 'desc' },
        take: MAX_ROWS + 1,
        include: {
          student: { select: { studentCode: true, fullNameEn: true, fullNameLo: true } },
          classSubject: { select: { class: { select: { classNameEn: true, classNameLo: true } }, subject: { select: { subjectNameEn: true, subjectNameLo: true } }, term: { select: { termNameEn: true, termNameLo: true, academicYear: true } } } },
          gradeType: { select: { typeNameEn: true, typeNameLo: true } },
        },
      });
      await send(req, res, {
        report: 'grades', file: 'grades', sheet: L('ຄະແນນ', 'Grades'), lang, rows,
        columns: [
          { header: L('ລະຫັດນັກຮຽນ', 'Student code'), value: (g) => g.student.studentCode, width: 16 },
          { header: L('ນັກຮຽນ', 'Student'), value: (g) => pick(lang, g.student.fullNameLo, g.student.fullNameEn), width: 26 },
          { header: L('ຫ້ອງຮຽນ', 'Class'), value: (g) => pick(lang, g.classSubject.class.classNameLo, g.classSubject.class.classNameEn), width: 10 },
          { header: L('ວິຊາ', 'Subject'), value: (g) => pick(lang, g.classSubject.subject.subjectNameLo, g.classSubject.subject.subjectNameEn), width: 18 },
          { header: L('ພາກຮຽນ', 'Term'), value: (g) => `${pick(lang, g.classSubject.term.termNameLo, g.classSubject.term.termNameEn)} ${g.classSubject.term.academicYear}`, width: 20 },
          { header: L('ປະເພດ', 'Type'), value: (g) => (g.gradeType ? pick(lang, g.gradeType.typeNameLo, g.gradeType.typeNameEn) : ''), width: 14 },
          { header: L('ເດືອນ', 'Month'), value: (g) => g.gradeMonth, width: 9 },
          { header: L('ຄະແນນ', 'Score'), value: (g) => (g.score === null ? '' : num(g.score)), width: 8 },
          { header: L('ຄະແນນເຕັມ', 'Max score'), value: (g) => num(g.maxScore), width: 10 },
          { header: L('%', '%'), value: (g) => (g.score === null || !num(g.maxScore) ? '' : Math.round((num(g.score) / num(g.maxScore)) * 1000) / 10), width: 7 },
          { header: L('ເຜີຍແຜ່', 'Published'), value: (g) => (g.isPublished ? (lang === 'lo' ? 'ແລ້ວ' : 'Yes') : (lang === 'lo' ? 'ຍັງ' : 'No')), width: 10 },
        ],
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /reports/wallet/export?search=&status=
  async wallet(req, res, next) {
    try {
      const lang = exportLang(req);
      const rows = await prisma.walletAccount.findMany({
        where: walletRepository.listWhere({ search: req.query.search || '', status: req.query.status }),
        orderBy: { updatedAt: 'desc' },
        take: MAX_ROWS + 1,
        include: { student: { select: { studentCode: true, fullNameEn: true, fullNameLo: true, spendingLimit: true } } },
      });
      const limit = (v: unknown) => (v == null ? '' : num(v));
      await send(req, res, {
        report: 'wallet', file: 'wallets', sheet: L('ກະເປົາເງິນ', 'Wallets'), lang, rows,
        columns: [
          { header: L('ລະຫັດນັກຮຽນ', 'Student code'), value: (w) => w.student.studentCode, width: 16 },
          { header: L('ນັກຮຽນ', 'Student'), value: (w) => pick(lang, w.student.fullNameLo, w.student.fullNameEn), width: 26 },
          { header: L('ຍອດເງິນ (₭)', 'Balance (₭)'), value: (w) => num(w.balance), width: 14 },
          { header: L('ວົງເງິນຕໍ່ມື້', 'Daily limit'), value: (w) => limit(w.student.spendingLimit?.dailyMax), width: 13 },
          { header: L('ວົງເງິນຕໍ່ອາທິດ', 'Weekly limit'), value: (w) => limit(w.student.spendingLimit?.weeklyMax), width: 13 },
          { header: L('ວົງເງິນຕໍ່ຄັ້ງ', 'Per purchase'), value: (w) => limit(w.student.spendingLimit?.perTransactionMax), width: 13 },
          { header: L('ສະຖານະ', 'Status'), value: (w) => (w.status === 'active' ? (lang === 'lo' ? 'ໃຊ້ງານ' : 'Active') : (lang === 'lo' ? 'ອາຍັດ' : 'Frozen')), width: 10 },
          { header: L('ວັນທີເປີດ', 'Opened'), value: (w) => date(w.createdAt), width: 12 },
        ],
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /reports/fees/export?academicYear=   (collection by class)
  async fees(req, res, next) {
    try {
      const lang = exportLang(req);
      const academicYear = typeof req.query.academicYear === 'string' && req.query.academicYear ? req.query.academicYear : await getCurrentAcademicYear();
      const report = await feeRepository.report(academicYear);
      await send(req, res, {
        report: 'fees', file: `fees-${academicYear}`, sheet: L('ຄ່າທຳນຽມ', 'Fees'), lang, rows: report.byClass,
        columns: [
          { header: L('ຫ້ອງຮຽນ', 'Class'), value: (c) => pick(lang, c.classNameLo, c.classNameEn), width: 12 },
          { header: L('ຍອດເກັບ (₭)', 'Billed (₭)'), value: (c) => c.billed, width: 14 },
          { header: L('ເກັບໄດ້ (₭)', 'Collected (₭)'), value: (c) => c.collected, width: 14 },
          { header: L('ຄ້າງ (₭)', 'Outstanding (₭)'), value: (c) => c.billed - c.collected, width: 14 },
          { header: L('ຈ່າຍຄົບ / ນັກຮຽນ', 'Paid / students'), value: (c) => `${c.paid} / ${c.students}`, width: 14 },
          { header: L('ອັດຕາເກັບ (%)', 'Collection rate (%)'), value: (c) => c.collectionRate, width: 14 },
        ],
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /reports/fees/debtors/export?academicYear=&classId=&search=
  async debtors(req, res, next) {
    try {
      const lang = exportLang(req);
      const year = typeof req.query.academicYear === 'string' && req.query.academicYear ? req.query.academicYear : undefined;
      const report = await schoolReportRepository.debtors(year);
      const classId = Number(req.query.classId) || null;
      const q = typeof req.query.search === 'string' ? req.query.search.trim().toLowerCase() : '';
      const rows = report.students.filter((s) =>
        (!classId || s.class?.classId === classId)
        && (!q || [s.fullNameLo, s.fullNameEn, s.studentCode].some((v) => v?.toLowerCase().includes(q))));
      await send(req, res, {
        report: 'debtors', file: `debtors-${year ?? 'all'}`, sheet: L('ຄ້າງຊຳລະ', 'Outstanding'), lang, rows,
        columns: [
          { header: L('ລະຫັດນັກຮຽນ', 'Student code'), value: (s) => s.studentCode, width: 16 },
          { header: L('ນັກຮຽນ', 'Student'), value: (s) => pick(lang, s.fullNameLo, s.fullNameEn), width: 26 },
          { header: L('ຫ້ອງຮຽນ', 'Class'), value: (s) => (s.class ? pick(lang, s.class.classNameLo, s.class.classNameEn) : ''), width: 10 },
          { header: L('ຜູ້ປົກຄອງ', 'Parent'), value: (s) => (s.parent ? pick(lang, s.parent.fullNameLo, s.parent.fullNameEn) : ''), width: 24 },
          { header: L('ເບີໂທ', 'Phone'), value: (s) => s.parent?.phoneNumber, width: 16 },
          { header: L('ລາຍການທີ່ຄ້າງ', 'Unpaid items'), value: (s) => s.invoices.map((i) => `${pick(lang, i.feeType.nameLo, i.feeType.nameEn)} (${i.academicYear})`).join(', '), width: 40 },
          { header: L('ຍອດຄ້າງ (₭)', 'Owed (₭)'), value: (s) => s.outstanding, width: 14 },
          { header: L('ມື້ທີ່ກາຍກຳນົດ', 'Days overdue'), value: (s) => s.maxDaysOverdue, width: 12 },
        ],
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /reports/daily-cash/export?date=YYYY-MM-DD
  async dailyCash(req, res, next) {
    try {
      const lang = exportLang(req);
      const day = typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date) ? req.query.date : schoolDateString(new Date());
      const report = await schoolReportRepository.dailyCash(day);
      await send(req, res, {
        report: 'daily_cash', file: `daily-cash-${day}`, sheet: L('ເງິນປະຈຳວັນ', 'Daily cash'), lang, rows: report.entries,
        columns: [
          { header: L('ເວລາ', 'Time'), value: (e) => time(e.time), width: 8 },
          { header: L('ປະເພດ', 'Type'), value: (e) => (e.kind === 'fee' ? (lang === 'lo' ? 'ຄ່າທຳນຽມ' : 'Fee') : (lang === 'lo' ? 'ເຕີມເງິນ' : 'Top-up')), width: 10 },
          { header: L('ເລກອ້າງອີງ', 'Reference'), value: (e) => e.reference, width: 18 },
          { header: L('ລະຫັດນັກຮຽນ', 'Student code'), value: (e) => e.student.studentCode, width: 16 },
          { header: L('ນັກຮຽນ', 'Student'), value: (e) => pick(lang, e.student.fullNameLo, e.student.fullNameEn), width: 26 },
          { header: L('ວິທີຊຳລະ', 'Method'), value: (e) => METHOD[e.method as keyof typeof METHOD]?.[lang] ?? e.method, width: 10 },
          { header: L('ຜູ້ຮັບເງິນ', 'Received by'), value: (e) => (e.staff ? pick(lang, e.staff.fullNameLo, e.staff.fullNameEn) : ''), width: 22 },
          { header: L('ຈຳນວນ (₭)', 'Amount (₭)'), value: (e) => e.amount, width: 14 },
        ],
      });
    } catch (error) {
      next(error);
    }
  }

  // GET /reports/class-results/export?classId=&termId=
  async classResults(req, res, next) {
    try {
      const lang = exportLang(req);
      const classId = Number(req.query.classId);
      const termId = Number(req.query.termId);
      if (!classId || !termId) return res.status(400).json({ success: false, message: 'classId and termId are required' });
      const d = await schoolReportRepository.classResults(classId, termId);
      await send(req, res, {
        report: 'class_results', file: `class-results-${d.class.classNameEn}-${d.term.termNameEn}`.replace(/[^\w.-]+/g, '_'),
        sheet: L('ຜົນການຮຽນ', 'Results'), lang, rows: d.students,
        columns: [
          { header: L('ອັນດັບ', 'Rank'), value: (s) => s.rank ?? '', width: 7 },
          { header: L('ລະຫັດນັກຮຽນ', 'Student code'), value: (s) => s.studentCode, width: 16 },
          { header: L('ນັກຮຽນ', 'Student'), value: (s) => pick(lang, s.fullNameLo, s.fullNameEn), width: 26 },
          ...d.subjects.map((sub) => ({ header: L(`${sub.subjectNameLo} (%)`, `${sub.subjectNameEn} (%)`), value: (s) => s.scores[sub.subjectId] ?? '', width: 12 })),
          { header: L('ສະເລ່ຍ (%)', 'Average (%)'), value: (s) => s.average ?? '', width: 11 },
          { header: L('ເກຣດ', 'Grade'), value: (s) => s.letter ?? '', width: 7 },
        ],
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new ReportExportController();
