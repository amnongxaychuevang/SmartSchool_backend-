import { z } from 'zod';

// ─── Auth ───────────────────────────────────────────────
export const loginSchema = z.object({
  phoneOrEmail: z.string().min(1, 'Phone number or email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});
export const logoutSchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

// ─── Attendance — hit by gate hardware, keep this permissive/simple ───
export const attendanceScanSchema = z.object({
  cardUid: z.string().min(1, 'Card UID is required'),
  gateLocation: z.string().optional(),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
export const dailyAttendanceQuerySchema = z.object({
  classId: z.coerce.number().int().positive(),
  date: isoDate,
});
export const dailyAttendanceSaveSchema = z.object({
  classId: z.coerce.number().int().positive(),
  date: isoDate,
  records: z.array(z.object({
    studentId: z.coerce.number().int().positive(),
    status: z.enum(['present', 'absent', 'late', 'excused']),
    note: z.string().max(255).optional(),
  })).min(1),
});

// ─── Wallet purchase — the money-moving endpoint, validate strictly ───
export const walletProcessSchema = z.object({
  studentId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  shopId: z.coerce.number().int().positive(),
});

export const walletTopUpSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  descriptionEn: z.string().max(255).optional(),
  descriptionLo: z.string().max(255).optional(),
});

export const walletStatusUpdateSchema = z.object({
  status: z.enum(['active', 'frozen']),
});

// ─── Top-up requests ────────────────────────────────────
export const topUpCreateSchema = z.object({
  studentId: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  method: z.enum(['cash', 'mobile_banking', 'admin_manual']),
  methodLabelEn: z.string().max(100).optional(),
  methodLabelLo: z.string().max(100).optional(),
  slipUrl: z.string().max(255).optional(),
});

export const topUpRejectSchema = z.object({
  rejectReason: z.string().max(1000).optional(),
});

// ─── Students ───────────────────────────────────────────
const studentBase = {
  fullNameEn: z.string().min(1).max(150),
  fullNameLo: z.string().min(1).max(150),
  dateOfBirth: z.coerce.date().optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  photoUrl: z.string().max(255).optional(),
  nationalityEn: z.string().max(50).optional(),
  nationalityLo: z.string().max(50).optional(),
  village: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  province: z.string().max(100).optional(),
  address: z.string().optional(),
  ethnicity: z.string().max(50).optional(),
  birthPlace: z.string().max(150).optional(),
  previousSchool: z.string().max(150).optional(),
  bloodType: z.enum(['A', 'B', 'AB', 'O', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
  medicalNotes: z.string().optional(),
  status: z.enum(['active', 'inactive', 'graduated', 'transferred']).optional(),
  notes: z.string().optional(),
  // Current-year class (null = remove from class) and parent links, saved with the student.
  classId: z.coerce.number().int().positive().nullable().optional(),
  parents: z.array(z.object({
    parentUserId: z.coerce.number().int().positive(),
    relationship: z.enum(['father', 'mother', 'guardian', 'grandparent', 'sibling', 'uncle_aunt', 'other']).optional(),
    isPrimaryContact: z.boolean().optional(),
  })).optional(),
};
export const studentCreateSchema = z.object({
  studentCode: z.string().min(1).max(20),
  ...studentBase,
});
// studentCode is editable too (it was silently dropped before).
export const studentUpdateSchema = z.object({ studentCode: z.string().min(1).max(20), ...studentBase }).partial();

// ─── Users (admin-managed accounts) ────────────────────
// Login is by phone number or email, so an account needs at least one of them.
const hasLoginIdentifier = (u: { email?: string; phoneNumber?: string }) => Boolean(u.email || u.phoneNumber?.trim());
const loginIdentifierError = { message: 'A phone number or an email is required', path: ['phoneNumber'] };

const userBase = {
  fullNameEn: z.string().min(1).max(150),
  fullNameLo: z.string().min(1).max(150),
  email: z.email().max(150).optional(),
  phoneNumber: z.string().max(20).optional(),
  roleId: z.coerce.number().int().positive(),
  langPref: z.enum(['en', 'lo']).optional(),
  avatarUrl: z.string().max(255).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
};
export const userCreateSchema = z.object(userBase).refine(hasLoginIdentifier, loginIdentifierError);
export const userUpdateSchema = z.object(userBase).partial();

// ─── Teachers ───────────────────────────────────────────
const teacherBase = {
  fullNameEn: z.string().min(1).max(150),
  fullNameLo: z.string().min(1).max(150),
  email: z.email().max(150).optional(),
  phoneNumber: z.string().max(20).optional(),
  password: z.string().min(6).optional(),
  isActive: z.boolean().optional(),
  employeeCode: z.string().max(20).optional(),
  specialization: z.string().max(100).optional(),
  qualification: z.string().max(150).optional(),
  hireDate: z.coerce.date().optional(),
  salary: z.coerce.number().nonnegative().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
};
export const teacherCreateSchema = z.object(teacherBase).refine(hasLoginIdentifier, loginIdentifierError);
export const teacherUpdateSchema = z.object(teacherBase).partial();

// ─── Parents (admin CRUD) ───────────────────────────────
const parentBase = {
  fullNameEn: z.string().min(1).max(150),
  fullNameLo: z.string().min(1).max(150),
  email: z.email().max(150).optional(),
  phoneNumber: z.string().max(20).optional(),
  password: z.string().min(6).optional(),
  isActive: z.boolean().optional(),
  occupation: z.string().max(150).optional(),
  address: z.string().optional(),
  emergencyContact: z.string().max(20).optional(),
  lineId: z.string().max(50).optional(),
  nationalId: z.string().max(30).optional(),
  notes: z.string().optional(),
};
export const parentCreateSchema = z.object(parentBase).refine(hasLoginIdentifier, loginIdentifierError);
export const parentUpdateSchema = z.object(parentBase).partial();

// ─── Classes ────────────────────────────────────────────
const classBase = {
  classNameEn: z.string().min(1).max(50),
  classNameLo: z.string().min(1).max(50),
  gradeLevelEn: z.string().max(20).optional(),
  gradeLevelLo: z.string().max(20).optional(),
  homeroomTeacherId: z.coerce.number().int().positive().optional(),
  academicYear: z.string().min(1).max(9),
  descriptionEn: z.string().optional(),
  descriptionLo: z.string().optional(),
  isActive: z.boolean().optional(),
};
export const classCreateSchema = z.object(classBase);
export const classUpdateSchema = z.object(classBase).partial();

// ─── Subjects ───────────────────────────────────────────
const subjectBase = {
  subjectNameEn: z.string().min(1).max(100),
  subjectNameLo: z.string().min(1).max(100),
  subjectCode: z.string().max(20).optional(),
  descriptionEn: z.string().optional(),
  descriptionLo: z.string().optional(),
  credits: z.coerce.number().positive().optional(),
  isActive: z.boolean().optional(),
};
export const subjectCreateSchema = z.object(subjectBase);
export const subjectUpdateSchema = z.object(subjectBase).partial();

// ─── Grades ─────────────────────────────────────────────
const gradeBase = {
  gradeTypeId: z.coerce.number().int().positive().optional(),
  score: z.coerce.number().min(0).optional(),
  maxScore: z.coerce.number().positive().optional(),
  gradeMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Expected YYYY-MM').optional(),
  remarks: z.string().optional(),
  isPublished: z.boolean().optional(),
};
export const gradeCreateSchema = z.object({
  studentId: z.coerce.number().int().positive(),
  // Either the ClassSubject directly, or class + subject (resolved in termId / the active term).
  classSubjectId: z.coerce.number().int().positive().optional(),
  classId: z.coerce.number().int().positive().optional(),
  subjectId: z.coerce.number().int().positive().optional(),
  termId: z.coerce.number().int().positive().optional(),
  teacherId: z.coerce.number().int().positive().optional(), // admins only; teachers are always themselves
  ...gradeBase,
}).refine((g) => g.classSubjectId !== undefined || (g.classId !== undefined && g.subjectId !== undefined), {
  message: 'Provide classSubjectId, or classId and subjectId',
  path: ['classSubjectId'],
});

// ─── Class subjects (subject taught to a class in a term) ───
export const classSubjectCreateSchema = z.object({
  classId: z.coerce.number().int().positive(),
  subjectId: z.coerce.number().int().positive(),
  termId: z.coerce.number().int().positive().optional(), // defaults to the active term
  teacherId: z.coerce.number().int().positive().nullable().optional(),
});
export const classSubjectUpdateSchema = z.object({
  teacherId: z.coerce.number().int().positive().nullable(),
});
export const gradeUpdateSchema = z.object(gradeBase).partial();

// ─── Cards ──────────────────────────────────────────────
export const cardCreateSchema = z.object({
  cardUid: z.string().min(1).max(50),
  studentId: z.coerce.number().int().positive(),
  expiredDate: z.coerce.date().optional(),
  notes: z.string().max(255).optional(),
});
export const cardUpdateSchema = z.object({
  status: z.enum(['active', 'lost', 'deactivated']).optional(),
  expiredDate: z.coerce.date().optional(),
  notes: z.string().max(255).optional(),
});

// ─── Shops ──────────────────────────────────────────────
const shopBase = {
  shopNameEn: z.string().min(1).max(100),
  shopNameLo: z.string().min(1).max(100),
  locationEn: z.string().max(100).optional(),
  locationLo: z.string().max(100).optional(),
  descriptionEn: z.string().optional(),
  descriptionLo: z.string().optional(),
  isActive: z.boolean().optional(),
};
export const shopCreateSchema = z.object(shopBase);
export const shopUpdateSchema = z.object(shopBase).partial();

// ─── Notifications ──────────────────────────────────────
export const notificationCreateSchema = z.object({
  recipientUserId: z.coerce.number().int().positive(),
  studentId: z.coerce.number().int().positive().optional(),
  type: z.enum(['check_in', 'check_out', 'absence', 'grade', 'transaction', 'general']),
  channel: z.enum(['sms', 'line', 'telegram', 'app_push', 'email']),
  messageEn: z.string().min(1),
  messageLo: z.string().min(1),
});

// ─── Spending limits (used by both the admin route and the parent-portal route) ───
export const spendingLimitUpsertSchema = z.object({
  dailyMax: z.coerce.number().nonnegative().optional(),
  weeklyMax: z.coerce.number().nonnegative().optional(),
  perTransactionMax: z.coerce.number().nonnegative().optional(),
  alertThreshold: z.coerce.number().nonnegative().optional(),
  blockedShops: z.array(z.coerce.number().int().positive()).optional(),
  notes: z.string().max(255).optional(),
});

// ─── Leave requests ─────────────────────────────────────
export const leaveRequestCreateSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  reason: z.string().optional(),
  documentUrl: z.string().max(255).optional(),
});
export const leaveRequestStatusUpdateSchema = z.object({
  status: z.enum(['approved', 'rejected']),
});

// ─── Announcements ──────────────────────────────────────
const announcementBase = {
  titleEn: z.string().min(1).max(255),
  titleLo: z.string().min(1).max(255),
  contentEn: z.string().min(1),
  contentLo: z.string().min(1),
  targetAudience: z.enum(['all', 'teachers', 'parents', 'class']).optional(),
  classId: z.coerce.number().int().positive().optional(),
  expiryDate: z.coerce.date().optional(),
};
export const announcementCreateSchema = z.object(announcementBase).refine(
  (a) => a.targetAudience !== 'class' || a.classId !== undefined,
  { message: 'classId is required when targetAudience is "class"', path: ['classId'] },
);
export const announcementUpdateSchema = z.object(announcementBase).partial();

// ─── Academic terms ─────────────────────────────────────
const academicTermBase = {
  academicYear: z.string().min(1).max(9),
  termNameEn: z.string().min(1).max(50),
  termNameLo: z.string().min(1).max(50),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  status: z.enum(['active', 'upcoming', 'completed']).optional(),
};
export const academicTermCreateSchema = z.object(academicTermBase);
export const academicTermUpdateSchema = z.object(academicTermBase).partial();

// ─── Settings — free-form key/value pairs, so only the shape is checked ───
export const settingsSaveSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean()])
);
