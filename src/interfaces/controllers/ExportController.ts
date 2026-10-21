import prisma from '../../infrastructure/database/PrismaClient';
import studentRepository from '../../infrastructure/repositories/StudentRepository';
import teacherRepository from '../../infrastructure/repositories/TeacherRepository';
import parentRepository from '../../infrastructure/repositories/ParentRepository';
import cardRepository from '../../infrastructure/repositories/CardRepository';
import auditLogRepository from '../../infrastructure/repositories/AuditLogRepository';
import { currentEnrolmentWhere } from '../../infrastructure/repositories/AcademicYear';
import { buildWorkbook, sendWorkbook, exportLang, type ExportColumn, type ExportLang } from '../../infrastructure/export/excel';
import { schoolDateString } from '../../domain/schoolTime';

// Every export is one standard: the list page's own filters, an .xlsx with
// bilingual headers, and an audit-log entry saying who exported what.

const MAX_ROWS = 20000;
const date = (d?: Date | null) => (d ? schoolDateString(d) : '');
const pick = (lang: ExportLang, lo?: string | null, en?: string | null) => (lang === 'lo' ? lo || en : en || lo) || '';
const place = (lang: ExportLang, x?: { nameLo: string; nameEn: string } | null) => (x ? pick(lang, x.nameLo, x.nameEn) : '');
const address = (lang: ExportLang, r: { village?: string | null; address?: string | null; district?: any; province?: any }) =>
  [r.address, r.village, place(lang, r.district), place(lang, r.province)].filter(Boolean).join(', ');

const GENDER = { male: { lo: 'ຊາຍ', en: 'Male' }, female: { lo: 'ຍິງ', en: 'Female' }, other: { lo: 'ອື່ນໆ', en: 'Other' } } as const;
const ACTIVE = { true: { lo: 'ໃຊ້ງານ', en: 'Active' }, false: { lo: 'ປິດໃຊ້ງານ', en: 'Inactive' } } as const;
const STUDENT_STATUS: Record<string, { lo: string; en: string }> = {
  active: { lo: 'ກຳລັງຮຽນ', en: 'Active' }, inactive: { lo: 'ບໍ່ໃຊ້ງານ', en: 'Inactive' },
  graduated: { lo: 'ຈົບການສຶກສາ', en: 'Graduated' }, transferred: { lo: 'ຍ້າຍໂຮງຮຽນ', en: 'Transferred' },
};
const CARD_STATUS: Record<string, { lo: string; en: string }> = {
  active: { lo: 'ໃຊ້ງານ', en: 'Active' }, lost: { lo: 'ເສຍ', en: 'Lost' }, deactivated: { lo: 'ປິດໃຊ້ງານ', en: 'Deactivated' },
};
const RELATION: Record<string, { lo: string; en: string }> = {
  father: { lo: 'ພໍ່', en: 'Father' }, mother: { lo: 'ແມ່', en: 'Mother' }, guardian: { lo: 'ຜູ້ປົກຄອງ', en: 'Guardian' },
  grandparent: { lo: 'ພໍ່ຕູ້/ແມ່ຕູ້', en: 'Grandparent' }, sibling: { lo: 'ອ້າຍ/ເອື້ອຍ', en: 'Sibling' }, other: { lo: 'ອື່ນໆ', en: 'Other' },
};
const label = (lang: ExportLang, map: Record<string, { lo: string; en: string }>, key?: string | null) => (key ? map[key]?.[lang] ?? key : '');

const tooMany = () => Object.assign(new Error(`Too many rows to export (over ${MAX_ROWS}); narrow the filters first`), { statusCode: 413 });

async function finish(req, res, opts: { entity: string; file: string; count: number; buffer: Buffer }) {
  await auditLogRepository.log({
    userId: req.user.userId,
    action: 'export',
    entityType: opts.entity,
    detail: { rows: opts.count, filters: { search: req.query.search || undefined, status: req.query.status || undefined, gender: req.query.gender || undefined, classId: req.query.classId || undefined } },
    ipAddress: req.ip,
  });
  sendWorkbook(res, opts.file, opts.buffer);
}

class ExportController {
  async students(req, res, next) {
    try {
      const lang = exportLang(req);
      const where = await studentRepository.listWhere({
        search: req.query.search || '', status: req.query.status, classId: req.query.classId,
        gender: ['male', 'female', 'other'].includes(req.query.gender) ? req.query.gender : undefined,
      });
      const enrolment = await currentEnrolmentWhere();
      const rows = await prisma.student.findMany({
        where,
        orderBy: { studentCode: 'asc' },
        take: MAX_ROWS + 1,
        include: {
          province: true, district: true, ethnicity: true,
          classStudents: { where: enrolment, take: 1, include: { class: { select: { classNameEn: true, classNameLo: true } } } },
          parentStudents: {
            orderBy: { isPrimaryContact: 'desc' },
            include: { parent: { select: { fullNameEn: true, fullNameLo: true, phoneNumber: true } } },
          },
        },
      });
      if (rows.length > MAX_ROWS) throw tooMany();
      type Row = (typeof rows)[number];
      const primary = (s: Row) => s.parentStudents[0];
      const columns: ExportColumn<Row>[] = [
        { header: { lo: 'ລະຫັດນັກຮຽນ', en: 'Student code' }, value: (s) => s.studentCode, width: 16 },
        { header: { lo: 'ຊື່ເຕັມ (ລາວ)', en: 'Full name (Lao)' }, value: (s) => s.fullNameLo, width: 26 },
        { header: { lo: 'ຊື່ເຕັມ (ອັງກິດ)', en: 'Full name (English)' }, value: (s) => s.fullNameEn, width: 26 },
        { header: { lo: 'ເພດ', en: 'Gender' }, value: (s) => (s.gender ? GENDER[s.gender][lang] : ''), width: 8 },
        { header: { lo: 'ວັນເກີດ', en: 'Date of birth' }, value: (s) => date(s.dateOfBirth), width: 12 },
        { header: { lo: 'ຫ້ອງຮຽນ', en: 'Class' }, value: (s) => { const c = s.classStudents[0]?.class; return c ? pick(lang, c.classNameLo, c.classNameEn) : ''; }, width: 10 },
        { header: { lo: 'ສະຖານະ', en: 'Status' }, value: (s) => label(lang, STUDENT_STATUS, s.status), width: 12 },
        { header: { lo: 'ສັນຊາດ', en: 'Nationality' }, value: (s) => pick(lang, s.nationalityLo, s.nationalityEn), width: 10 },
        { header: { lo: 'ຊົນເຜົ່າ', en: 'Ethnicity' }, value: (s) => (s.ethnicity ? pick(lang, s.ethnicity.nameLo, s.ethnicity.nameEn) : ''), width: 12 },
        { header: { lo: 'ບ່ອນເກີດ', en: 'Place of birth' }, value: (s) => s.birthPlace, width: 18 },
        { header: { lo: 'ທີ່ຢູ່', en: 'Address' }, value: (s) => address(lang, s), width: 36 },
        { header: { lo: 'ກຸ່ມເລືອດ', en: 'Blood type' }, value: (s) => s.bloodType, width: 9 },
        { header: { lo: 'ຂໍ້ມູນສຸຂະພາບ', en: 'Medical notes' }, value: (s) => s.medicalNotes, width: 28 },
        { header: { lo: 'ໂຮງຮຽນເກົ່າ', en: 'Previous school' }, value: (s) => s.previousSchool, width: 20 },
        { header: { lo: 'ຜູ້ປົກຄອງ', en: 'Parent' }, value: (s) => { const p = primary(s); return p ? pick(lang, p.parent.fullNameLo, p.parent.fullNameEn) : ''; }, width: 24 },
        { header: { lo: 'ຄວາມສຳພັນ', en: 'Relationship' }, value: (s) => label(lang, RELATION, primary(s)?.relationship), width: 12 },
        { header: { lo: 'ເບີໂທຜູ້ປົກຄອງ', en: 'Parent phone' }, value: (s) => primary(s)?.parent.phoneNumber, width: 16 },
        { header: { lo: 'ໝາຍເຫດ', en: 'Notes' }, value: (s) => s.notes, width: 28 },
      ];
      await finish(req, res, { entity: 'student', file: 'students', count: rows.length, buffer: buildWorkbook(lang === 'lo' ? 'ນັກຮຽນ' : 'Students', columns, rows, lang) });
    } catch (error) {
      next(error);
    }
  }

  async teachers(req, res, next) {
    try {
      const lang = exportLang(req);
      const where = teacherRepository.listWhere({
        search: req.query.search || '', status: req.query.status,
        gender: ['male', 'female', 'other'].includes(req.query.gender) ? req.query.gender : undefined,
      });
      const rows = await prisma.teacher.findMany({
        where,
        orderBy: { employeeCode: 'asc' },
        take: MAX_ROWS + 1,
        include: { user: true, province: true, district: true },
      });
      if (rows.length > MAX_ROWS) throw tooMany();
      type Row = (typeof rows)[number];
      const columns: ExportColumn<Row>[] = [
        { header: { lo: 'ລະຫັດພະນັກງານ', en: 'Employee code' }, value: (r) => r.employeeCode, width: 16 },
        { header: { lo: 'ຊື່ເຕັມ (ລາວ)', en: 'Full name (Lao)' }, value: (r) => r.user.fullNameLo, width: 26 },
        { header: { lo: 'ຊື່ເຕັມ (ອັງກິດ)', en: 'Full name (English)' }, value: (r) => r.user.fullNameEn, width: 26 },
        { header: { lo: 'ເພດ', en: 'Gender' }, value: (r) => (r.gender ? GENDER[r.gender][lang] : ''), width: 8 },
        { header: { lo: 'ເບີໂທ', en: 'Phone' }, value: (r) => r.user.phoneNumber, width: 16 },
        { header: { lo: 'ອີເມວ', en: 'Email' }, value: (r) => r.user.email, width: 26 },
        { header: { lo: 'ຄວາມຊຳນານ', en: 'Specialization' }, value: (r) => r.specialization, width: 18 },
        { header: { lo: 'ວຸດທິການສຶກສາ', en: 'Qualification' }, value: (r) => r.qualification, width: 20 },
        { header: { lo: 'ວັນເຂົ້າເຮັດວຽກ', en: 'Hire date' }, value: (r) => date(r.hireDate), width: 12 },
        { header: { lo: 'ທີ່ຢູ່', en: 'Address' }, value: (r) => address(lang, r), width: 36 },
        { header: { lo: 'ສະຖານະ', en: 'Status' }, value: (r) => ACTIVE[String(r.user.isActive) as 'true' | 'false'][lang], width: 10 },
      ];
      await finish(req, res, { entity: 'teacher', file: 'teachers', count: rows.length, buffer: buildWorkbook(lang === 'lo' ? 'ຄູ' : 'Teachers', columns, rows, lang) });
    } catch (error) {
      next(error);
    }
  }

  async parents(req, res, next) {
    try {
      const lang = exportLang(req);
      const where = parentRepository.listWhere({ search: req.query.search || '', status: req.query.status });
      const rows = await prisma.parent.findMany({
        where,
        orderBy: { parentId: 'asc' },
        take: MAX_ROWS + 1,
        include: {
          user: true, province: true, district: true,
          studentLinks: { include: { student: { select: { studentCode: true, fullNameEn: true, fullNameLo: true } } } },
        },
      });
      if (rows.length > MAX_ROWS) throw tooMany();
      type Row = (typeof rows)[number];
      const columns: ExportColumn<Row>[] = [
        { header: { lo: 'ຊື່ເຕັມ (ລາວ)', en: 'Full name (Lao)' }, value: (r) => r.user.fullNameLo, width: 26 },
        { header: { lo: 'ຊື່ເຕັມ (ອັງກິດ)', en: 'Full name (English)' }, value: (r) => r.user.fullNameEn, width: 26 },
        { header: { lo: 'ເບີໂທ', en: 'Phone' }, value: (r) => r.user.phoneNumber, width: 16 },
        { header: { lo: 'ອີເມວ', en: 'Email' }, value: (r) => r.user.email, width: 26 },
        { header: { lo: 'ລູກ', en: 'Children' }, value: (r) => r.studentLinks.map((l) => `${pick(lang, l.student.fullNameLo, l.student.fullNameEn)} (${l.student.studentCode}, ${label(lang, RELATION, l.relationship)})`).join('; '), width: 44 },
        { header: { lo: 'ອາຊີບ', en: 'Occupation' }, value: (r) => r.occupation, width: 18 },
        { header: { lo: 'ເລກບັດປະຈຳຕົວ', en: 'National ID' }, value: (r) => r.nationalId, width: 18 },
        { header: { lo: 'ເບີຕິດຕໍ່ສຸກເສີນ', en: 'Emergency contact' }, value: (r) => r.emergencyContact, width: 16 },
        { header: { lo: 'ທີ່ຢູ່', en: 'Address' }, value: (r) => address(lang, r), width: 36 },
        { header: { lo: 'ສະຖານະ', en: 'Status' }, value: (r) => ACTIVE[String(r.user.isActive) as 'true' | 'false'][lang], width: 10 },
      ];
      await finish(req, res, { entity: 'parent', file: 'parents', count: rows.length, buffer: buildWorkbook(lang === 'lo' ? 'ຜູ້ປົກຄອງ' : 'Parents', columns, rows, lang) });
    } catch (error) {
      next(error);
    }
  }

  async cards(req, res, next) {
    try {
      const lang = exportLang(req);
      const where = cardRepository.listWhere({ status: req.query.status, search: req.query.search });
      const enrolment = await currentEnrolmentWhere();
      const rows = await prisma.card.findMany({
        where,
        orderBy: { cardId: 'asc' },
        take: MAX_ROWS + 1,
        include: {
          student: {
            select: {
              studentCode: true, fullNameEn: true, fullNameLo: true,
              classStudents: { where: enrolment, take: 1, include: { class: { select: { classNameEn: true, classNameLo: true } } } },
            },
          },
        },
      });
      if (rows.length > MAX_ROWS) throw tooMany();
      type Row = (typeof rows)[number];
      const columns: ExportColumn<Row>[] = [
        { header: { lo: 'ລະຫັດບັດ (UID)', en: 'Card UID' }, value: (r) => r.cardUid, width: 18 },
        { header: { lo: 'ລະຫັດນັກຮຽນ', en: 'Student code' }, value: (r) => r.student?.studentCode, width: 16 },
        { header: { lo: 'ນັກຮຽນ', en: 'Student' }, value: (r) => (r.student ? pick(lang, r.student.fullNameLo, r.student.fullNameEn) : ''), width: 26 },
        { header: { lo: 'ຫ້ອງຮຽນ', en: 'Class' }, value: (r) => { const c = r.student?.classStudents[0]?.class; return c ? pick(lang, c.classNameLo, c.classNameEn) : ''; }, width: 10 },
        { header: { lo: 'ສະຖານະ', en: 'Status' }, value: (r) => label(lang, CARD_STATUS, r.status), width: 12 },
        { header: { lo: 'ວັນອອກບັດ', en: 'Issued' }, value: (r) => date(r.issuedDate), width: 12 },
        { header: { lo: 'ວັນໝົດອາຍຸ', en: 'Expires' }, value: (r) => date(r.expiredDate), width: 12 },
        { header: { lo: 'ໝາຍເຫດ', en: 'Notes' }, value: (r) => r.notes, width: 28 },
      ];
      await finish(req, res, { entity: 'card', file: 'student-cards', count: rows.length, buffer: buildWorkbook(lang === 'lo' ? 'ບັດນັກຮຽນ' : 'Cards', columns, rows, lang) });
    } catch (error) {
      next(error);
    }
  }
}

export default new ExportController();
