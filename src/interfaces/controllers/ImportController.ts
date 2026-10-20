import multer from 'multer';
import * as XLSX from 'xlsx';
import prisma from '../../infrastructure/database/PrismaClient';
import { nextStudentCode } from '../../infrastructure/repositories/StudentRepository';
import { checkAddress } from '../../infrastructure/repositories/Address';

// ── File upload middleware ──────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      // Some browsers send generic mime for .csv
      'application/octet-stream',
    ];
    cb(null, allowed.includes(file.mimetype) || file.originalname.match(/\.(csv|xlsx?)$/i) !== null);
  },
});

export const uploadFile = (req, res, next) =>
  upload.single('file')(req, res, (err) => {
    if (!err && !req.file) return res.status(400).json({ success: false, message: 'Upload a CSV or Excel file' });
    if (err) {
      const message = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
        ? 'File must be 10 MB or smaller'
        : 'Invalid upload';
      return res.status(400).json({ success: false, message });
    }
    next();
  });

// ── Parse file to rows ─────────────────────────────────
function parseFile(buffer: Buffer, originalname: string): Record<string, string>[] {
  const isCSV = /\.csv$/i.test(originalname);

  if (isCSV) {
    // Parse CSV: handle UTF-8 BOM
    let text = buffer.toString('utf-8');
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const wb = XLSX.read(text, { type: 'string', raw: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
  }

  // Excel
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '', raw: false });
}

// ── Validation helpers ─────────────────────────────────
type RowError = { row: number; field: string; message: string };

function requireString(val: unknown): string {
  return String(val ?? '').trim();
}

function validateStudentRow(row: Record<string, string>, idx: number): { data: any; errors: RowError[] } {
  const errors: RowError[] = [];
  const r = (field: string) => requireString(row[field]);

  const fullNameEn = r('fullNameEn');
  const fullNameLo = r('fullNameLo');
  const dateOfBirth = r('dateOfBirth');
  const gender = r('gender').toLowerCase();
  const classId = r('classId');
  const nationalityEn = r('nationalityEn');
  const nationalityLo = r('nationalityLo');
  const village = r('village');
  const provinceId = r('provinceId');
  const districtId = r('districtId');

  if (!fullNameEn) errors.push({ row: idx, field: 'fullNameEn', message: 'Required' });
  if (!fullNameLo) errors.push({ row: idx, field: 'fullNameLo', message: 'Required' });
  if (dateOfBirth && !/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) {
    errors.push({ row: idx, field: 'dateOfBirth', message: 'Must be YYYY-MM-DD' });
  }
  if (gender && !['male', 'female', 'other'].includes(gender)) {
    errors.push({ row: idx, field: 'gender', message: 'Must be male, female, or other' });
  }

  const data: any = { fullNameEn, fullNameLo };
  if (dateOfBirth) data.dateOfBirth = new Date(dateOfBirth);
  if (gender) data.gender = gender;
  if (classId) data.classId = parseInt(classId) || null;
  if (nationalityEn) data.nationalityEn = nationalityEn;
  if (nationalityLo) data.nationalityLo = nationalityLo;
  if (village) data.village = village;
  if (provinceId) data.provinceId = parseInt(provinceId) || null;
  if (districtId) data.districtId = parseInt(districtId) || null;

  return { data, errors };
}

function validateTeacherRow(row: Record<string, string>, idx: number): { data: any; errors: RowError[] } {
  const errors: RowError[] = [];
  const r = (field: string) => requireString(row[field]);

  const fullNameEn = r('fullNameEn');
  const fullNameLo = r('fullNameLo');
  const gender = r('gender').toLowerCase();
  const specialization = r('specialization');
  const qualification = r('qualification');
  const phoneNumber = r('phoneNumber');
  const email = r('email');

  if (!fullNameEn) errors.push({ row: idx, field: 'fullNameEn', message: 'Required' });
  if (!fullNameLo) errors.push({ row: idx, field: 'fullNameLo', message: 'Required' });
  if (gender && !['male', 'female', 'other'].includes(gender)) {
    errors.push({ row: idx, field: 'gender', message: 'Must be male, female, or other' });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ row: idx, field: 'email', message: 'Invalid email' });
  }

  return {
    data: {
      fullNameEn, fullNameLo,
      ...(gender ? { gender } : {}),
      ...(specialization ? { specialization } : {}),
      ...(qualification ? { qualification } : {}),
      ...(phoneNumber ? { phoneNumber } : {}),
      ...(email ? { email } : {}),
    },
    errors,
  };
}

function validateParentRow(row: Record<string, string>, idx: number): { data: any; errors: RowError[] } {
  const errors: RowError[] = [];
  const r = (field: string) => requireString(row[field]);

  const fullNameEn = r('fullNameEn');
  const fullNameLo = r('fullNameLo');
  const phoneNumber = r('phoneNumber');
  const email = r('email');
  const occupation = r('occupation');
  const studentCodes = r('studentCodes');

  if (!fullNameEn) errors.push({ row: idx, field: 'fullNameEn', message: 'Required' });
  if (!fullNameLo) errors.push({ row: idx, field: 'fullNameLo', message: 'Required' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push({ row: idx, field: 'email', message: 'Invalid email' });
  }

  return {
    data: {
      fullNameEn, fullNameLo,
      ...(phoneNumber ? { phoneNumber } : {}),
      ...(email ? { email } : {}),
      ...(occupation ? { occupation } : {}),
      studentCodes: studentCodes ? studentCodes.split(',').map(s => s.trim()).filter(Boolean) : [],
    },
    errors,
  };
}

// ── Controller ─────────────────────────────────────────
class ImportController {

  // ── POST /import/students ─────────────────────────────
  async importStudents(req, res, next) {
    try {
      const rows = parseFile(req.file.buffer, req.file.originalname);
      if (rows.length === 0) return res.status(400).json({ success: false, message: 'File is empty' });

      const allErrors: RowError[] = [];
      const validated: any[] = [];

      for (let i = 0; i < rows.length; i++) {
        const { data, errors } = validateStudentRow(rows[i], i + 2); // +2 for 1-indexed + header
        if (errors.length) allErrors.push(...errors);
        else validated.push(data);
      }

      if (allErrors.length > 0) {
        return res.json({ success: true, data: { imported: 0, errors: allErrors } });
      }

      let imported = 0;
      const importErrors: RowError[] = [];

      // Process in a transaction for atomicity
      await prisma.$transaction(async (tx) => {
        for (let i = 0; i < validated.length; i++) {
          const { classId, ...studentData } = validated[i];
          try {
            const studentCode = await nextStudentCode(tx);
            const student = await tx.student.create({
              data: { ...studentData, studentCode, status: 'active' },
            });
            if (classId) {
              // Get current academic year
              const term = await tx.academicTerm.findFirst({
                where: { isCurrent: true },
                select: { academicYear: true },
              });
              const year = term?.academicYear || String(new Date().getFullYear());
              const cls = await tx.class.findFirst({
                where: { classId, academicYear: year },
              });
              if (cls) {
                await tx.classStudent.create({
                  data: { classId: cls.classId, studentId: student.studentId },
                });
              }
            }
            imported++;
          } catch (err: any) {
            importErrors.push({
              row: i + 2,
              field: '',
              message: err?.message || 'Failed to create student',
            });
          }
        }
      });

      res.json({ success: true, data: { imported, errors: importErrors } });
    } catch (error) {
      next(error);
    }
  }

  // ── POST /import/teachers ─────────────────────────────
  async importTeachers(req, res, next) {
    try {
      const rows = parseFile(req.file.buffer, req.file.originalname);
      if (rows.length === 0) return res.status(400).json({ success: false, message: 'File is empty' });

      const allErrors: RowError[] = [];
      const validated: any[] = [];

      for (let i = 0; i < rows.length; i++) {
        const { data, errors } = validateTeacherRow(rows[i], i + 2);
        if (errors.length) allErrors.push(...errors);
        else validated.push(data);
      }

      if (allErrors.length > 0) {
        return res.json({ success: true, data: { imported: 0, errors: allErrors } });
      }

      let imported = 0;
      const importErrors: RowError[] = [];

      await prisma.$transaction(async (tx) => {
        // Get next employee code base
        const lastTeacher = await tx.teacher.findFirst({
          where: { employeeCode: { startsWith: 'TCH-' } },
          orderBy: { teacherId: 'desc' },
          select: { employeeCode: true },
        });
        let nextNumber = 1;
        if (lastTeacher?.employeeCode) {
          const match = lastTeacher.employeeCode.match(/TCH-(\d+)/);
          if (match) nextNumber = parseInt(match[1], 10) + 1;
        }

        for (let i = 0; i < validated.length; i++) {
          const { fullNameEn, fullNameLo, email, phoneNumber, ...teacherData } = validated[i];
          try {
            const userData = {
              fullNameEn, fullNameLo,
              ...(email ? { email } : {}),
              ...(phoneNumber ? { phoneNumber } : {}),
              passwordHash: null,
              isActive: true,
            };

            const user = await tx.user.create({
              data: { ...userData, role: { connect: { code: 'teacher' } } },
            });

            const employeeCode = `TCH-${String(nextNumber).padStart(4, '0')}`;
            nextNumber++;

            await tx.teacher.create({
              data: { ...teacherData, employeeCode, userId: user.userId },
            });

            imported++;
          } catch (err: any) {
            importErrors.push({
              row: i + 2,
              field: '',
              message: err?.message || 'Failed to create teacher',
            });
          }
        }
      });

      res.json({ success: true, data: { imported, errors: importErrors } });
    } catch (error) {
      next(error);
    }
  }

  // ── POST /import/parents ──────────────────────────────
  async importParents(req, res, next) {
    try {
      const rows = parseFile(req.file.buffer, req.file.originalname);
      if (rows.length === 0) return res.status(400).json({ success: false, message: 'File is empty' });

      const allErrors: RowError[] = [];
      const validated: any[] = [];

      for (let i = 0; i < rows.length; i++) {
        const { data, errors } = validateParentRow(rows[i], i + 2);
        if (errors.length) allErrors.push(...errors);
        else validated.push(data);
      }

      if (allErrors.length > 0) {
        return res.json({ success: true, data: { imported: 0, errors: allErrors } });
      }

      let imported = 0;
      const importErrors: RowError[] = [];

      await prisma.$transaction(async (tx) => {
        for (let i = 0; i < validated.length; i++) {
          const { fullNameEn, fullNameLo, phoneNumber, email, studentCodes, ...parentData } = validated[i];
          try {
            const userData: any = {
              fullNameEn, fullNameLo,
              ...(phoneNumber ? { phoneNumber } : {}),
              passwordHash: null,
              isActive: true,
            };

            const user = await tx.user.create({
              data: { ...userData, role: { connect: { code: 'parent' } } },
            });

            const parent = await tx.parent.create({
              data: { ...parentData, userId: user.userId },
            });

            // Link to students by their studentCode
            if (studentCodes && studentCodes.length > 0) {
              const students = await tx.student.findMany({
                where: { studentCode: { in: studentCodes } },
                select: { studentId: true, studentCode: true },
              });

              const foundCodes = students.map(s => s.studentCode);
              const missingCodes = studentCodes.filter((c: string) => !foundCodes.includes(c));
              if (missingCodes.length > 0) {
                importErrors.push({
                  row: i + 2,
                  field: 'studentCodes',
                  message: `Student codes not found: ${missingCodes.join(', ')}`,
                });
              }

              if (students.length > 0) {
                await tx.parentStudent.createMany({
                  data: students.map((s, idx) => ({
                    studentId: s.studentId,
                    parentUserId: user.userId,
                    relationship: 'guardian',
                    isPrimaryContact: idx === 0,
                  })),
                });
              }
            }

            imported++;
          } catch (err: any) {
            importErrors.push({
              row: i + 2,
              field: '',
              message: err?.message || 'Failed to create parent',
            });
          }
        }
      });

      res.json({ success: true, data: { imported, errors: importErrors } });
    } catch (error) {
      next(error);
    }
  }
}

export default new ImportController();
