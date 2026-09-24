import { Router  } from 'express';
import rateLimit from 'express-rate-limit';
const router = Router();

// Controllers
import authController from '../../interfaces/controllers/AuthController';
import attendanceController from '../../interfaces/controllers/AttendanceController';
import walletController from '../../interfaces/controllers/WalletController';
import walletAdminController from '../../interfaces/controllers/WalletAdminController';
import studentController from '../../interfaces/controllers/StudentController';
import userController from '../../interfaces/controllers/UserController';
import classController from '../../interfaces/controllers/ClassController';
import dashboardController from '../../interfaces/controllers/DashboardController';
import teacherController from '../../interfaces/controllers/TeacherController';
import parentController from '../../interfaces/controllers/ParentController';
import subjectController from '../../interfaces/controllers/SubjectController';
import gradeController from '../../interfaces/controllers/GradeController';
import cardController from '../../interfaces/controllers/CardController';
import topUpController from '../../interfaces/controllers/TopUpController';
import shopController from '../../interfaces/controllers/ShopController';
import notificationController from '../../interfaces/controllers/NotificationController';
import spendingLimitController from '../../interfaces/controllers/SpendingLimitController';
import settingsController from '../../interfaces/controllers/SettingsController';
import roleController from '../../interfaces/controllers/RoleController';
import scheduleController from '../../interfaces/controllers/ScheduleController';
import leaveRequestController from '../../interfaces/controllers/LeaveRequestController';
import academicTermController from '../../interfaces/controllers/AcademicTermController';
import classSubjectController from '../../interfaces/controllers/ClassSubjectController';
import auditLogController from '../../interfaces/controllers/AuditLogController';
import reportController from '../../interfaces/controllers/ReportController';
import feeController from '../../interfaces/controllers/FeeController';

// Middlewares
import AuthMiddleware from '../../interfaces/middlewares/AuthMiddleware';
import validate from '../../interfaces/middlewares/validate';
import {
  loginSchema, refreshTokenSchema, logoutSchema, attendanceScanSchema,
  dailyAttendanceQuerySchema, dailyAttendanceSaveSchema, attendanceReportQuerySchema, absenceNotifySchema,
  walletProcessSchema, walletTopUpSchema, walletStatusUpdateSchema,
  topUpCreateSchema, topUpRejectSchema,
  studentCreateSchema, studentUpdateSchema,
  userCreateSchema, userUpdateSchema,
  teacherCreateSchema, teacherUpdateSchema,
  parentCreateSchema, parentUpdateSchema,
  classCreateSchema, classUpdateSchema,
  subjectCreateSchema, subjectUpdateSchema,
  gradeCreateSchema, gradeUpdateSchema,
  cardCreateSchema, cardUpdateSchema,
  shopCreateSchema, shopUpdateSchema,
  notificationCreateSchema,
  spendingLimitUpsertSchema,
  leaveRequestCreateSchema, leaveRequestStatusUpdateSchema,
  announcementCreateSchema, announcementUpdateSchema,
  academicTermCreateSchema, academicTermUpdateSchema,
  classSubjectCreateSchema, classSubjectUpdateSchema, scheduleSchema,
  settingsSaveSchema,
  roleCreateSchema, roleUpdateSchema,
  feeTypeCreateSchema, feeTypeUpdateSchema, feeStructureCreateSchema, feeStructureUpdateSchema,
  invoiceUpdateSchema, invoiceVoidSchema, feePaymentSchema,
} from '../../interfaces/validators/schemas';

// Strict limiter for credential-guessing-prone / abuse-prone endpoints.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again later' },
});
const scanLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30, // generous for a busy gate, still bounds spam
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'API routes are working' });
});

// ─── Auth ───────────────────────────────────────────────
router.post('/auth/login', loginLimiter, validate(loginSchema), authController.login);
router.get('/auth/me', AuthMiddleware.verifyToken, authController.me);
// No verifyToken here by design — the refresh token itself is the credential
// (the access token that would normally satisfy verifyToken has, by definition,
// just expired when a client needs to call this).
router.post('/auth/refresh', loginLimiter, validate(refreshTokenSchema), authController.refresh);
router.post('/auth/logout', validate(logoutSchema), authController.logout);

// ─── Dashboard (Admin) ──────────────────────────────────
router.get('/dashboard/stats', AuthMiddleware.verifyToken, AuthMiddleware.authorize('dashboard.view'), dashboardController.stats);

// ─── Students (Admin/Teacher) ───────────────────────────
router.get('/students', AuthMiddleware.verifyToken, AuthMiddleware.authorize('students.view', ['teacher']), studentController.list);
router.get('/students/meta/statuses', AuthMiddleware.verifyToken, AuthMiddleware.authorize('students.view', ['teacher']), studentController.getStatuses);
router.get('/students/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('students.view', ['teacher']), studentController.get);
router.post('/students', AuthMiddleware.verifyToken, AuthMiddleware.authorize('students.manage', ['teacher']), validate(studentCreateSchema), studentController.create);
router.put('/students/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('students.manage', ['teacher']), validate(studentUpdateSchema), studentController.update);


// ─── Users (Admin) ──────────────────────────────────────
router.get('/users', AuthMiddleware.verifyToken, AuthMiddleware.authorize('users.manage'), userController.list);
router.post('/users', AuthMiddleware.verifyToken, AuthMiddleware.authorize('users.manage'), validate(userCreateSchema), userController.create);
router.put('/users/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('users.manage'), validate(userUpdateSchema), userController.update);

// ─── Roles ──────────────────────────────────────────────
router.get('/roles', AuthMiddleware.verifyToken, AuthMiddleware.authorize(['users.manage', 'roles.manage']), roleController.list);
router.get('/permissions', AuthMiddleware.verifyToken, AuthMiddleware.authorize('roles.manage'), roleController.catalog);
router.post('/roles', AuthMiddleware.verifyToken, AuthMiddleware.authorize('roles.manage'), validate(roleCreateSchema), roleController.create);
router.put('/roles/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('roles.manage'), validate(roleUpdateSchema), roleController.update);
router.delete('/roles/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('roles.manage'), roleController.delete);

// ─── Teachers (Admin) ───────────────────────────────────
router.get('/teachers', AuthMiddleware.verifyToken, AuthMiddleware.authorize('teachers.view'), teacherController.list);
router.post('/teachers', AuthMiddleware.verifyToken, AuthMiddleware.authorize('teachers.manage'), validate(teacherCreateSchema), teacherController.create);
router.put('/teachers/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('teachers.manage'), validate(teacherUpdateSchema), teacherController.update);

// ─── Parents (Admin) ────────────────────────────────────
router.get('/parents', AuthMiddleware.verifyToken, AuthMiddleware.authorize('parents.view'), parentController.list);
router.post('/parents', AuthMiddleware.verifyToken, AuthMiddleware.authorize('parents.manage'), validate(parentCreateSchema), parentController.create);
router.put('/parents/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('parents.manage'), validate(parentUpdateSchema), parentController.update);

// ─── Parents (Parent Portal) ────────────────────────────
router.get('/parents/me/announcements', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), parentController.getAnnouncements);
router.get('/parents/me/children', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), parentController.getMyChildren);
router.get('/parents/me/children/:studentId/attendance', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), parentController.getChildAttendance);
router.get('/parents/me/children/:studentId/grades', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), parentController.getChildGrades);
router.get('/parents/me/children/:studentId/wallet', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), parentController.getChildWallet);
router.get('/parents/me/children/:studentId/schedule', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), parentController.getChildSchedule);
router.get('/parents/me/children/:studentId/leave-requests', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), parentController.getLeaveRequests);
router.post('/parents/me/children/:studentId/leave-requests', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), validate(leaveRequestCreateSchema), parentController.createLeaveRequest);
router.get('/parents/me/children/:studentId/spending-limits', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), parentController.getSpendingLimits);
router.put('/parents/me/children/:studentId/spending-limits', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), validate(spendingLimitUpsertSchema), parentController.updateSpendingLimits);

// ─── Classes (Admin/Teacher) ────────────────────────────
router.get('/classes', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.view', ['teacher']), classController.list);
router.post('/classes', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.manage'), validate(classCreateSchema), classController.create);
router.put('/classes/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.manage'), validate(classUpdateSchema), classController.update);
router.delete('/classes/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.manage'), classController.delete);

// ─── Schedules (Teacher) ────────────────────────────────
router.get('/schedules', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.view', ['teacher']), scheduleController.list);
router.post('/schedules', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.manage'), validate(scheduleSchema), scheduleController.create);
router.put('/schedules/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.manage'), validate(scheduleSchema), scheduleController.update);
router.delete('/schedules/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.manage'), scheduleController.delete);

// ─── Leave Requests (Teacher) ───────────────────────────
router.get('/leave-requests', AuthMiddleware.verifyToken, AuthMiddleware.authorize('leave.manage', ['teacher']), leaveRequestController.list);
router.put('/leave-requests/:id/status', AuthMiddleware.verifyToken, AuthMiddleware.authorize('leave.manage', ['teacher']), validate(leaveRequestStatusUpdateSchema), leaveRequestController.updateStatus);

// ─── Attendance ─────────────────────────────────────────
// Hit by unauthenticated gate hardware — protected by a shared device key instead of a user JWT.
router.post('/attendance/scan', scanLimiter, AuthMiddleware.verifyDeviceKey, validate(attendanceScanSchema), attendanceController.scanCard);
// Admin's manual/simulated tap: same use case as the gate, authenticated as a user
// instead of with the device key (which must never reach a browser).
router.post('/attendance/scan/manual', scanLimiter, AuthMiddleware.verifyToken, AuthMiddleware.authorize('attendance.manual_tap'), validate(attendanceScanSchema), attendanceController.scanCard);
router.get('/attendance/daily', AuthMiddleware.verifyToken, AuthMiddleware.authorize('attendance.manage', ['teacher']), validate(dailyAttendanceQuerySchema, 'query'), attendanceController.listDaily);
router.put('/attendance/daily', AuthMiddleware.verifyToken, AuthMiddleware.authorize('attendance.manage', ['teacher']), validate(dailyAttendanceSaveSchema), attendanceController.saveDaily);

// ─── Wallet (shop purchase) ─────────────────────────────
// No dedicated "cashier/shop-staff" role exists yet, so this is restricted to admin as an
// interim measure. TODO: introduce a proper POS/staff role once that workflow is designed.
router.post('/wallet/process', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.pos'), validate(walletProcessSchema), walletController.processTransaction);

// ─── Wallet Admin ───────────────────────────────────────
router.get('/wallets', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.view'), walletAdminController.listWallets);
router.get('/wallets/student/:studentId', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.view'), walletAdminController.getWalletByStudent);
router.get('/wallets/:walletId/transactions', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.view'), walletAdminController.listTransactions);
router.post('/wallets/:walletId/topup', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.wallets_manage'), validate(walletTopUpSchema), walletAdminController.topUp);
router.put('/wallets/:walletId/status', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.wallets_manage'), validate(walletStatusUpdateSchema), walletAdminController.updateStatus);

// ─── Subjects (Admin/Teacher) ───────────────────────────
router.get('/subjects', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.view', ['teacher']), subjectController.list);
router.post('/subjects', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.manage'), validate(subjectCreateSchema), subjectController.create);
router.put('/subjects/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.manage'), validate(subjectUpdateSchema), subjectController.update);
router.delete('/subjects/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.manage'), subjectController.delete);

// ─── Class subjects (who teaches which subject to which class, per term) ───
router.get('/class-subjects', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.view', ['teacher']), classSubjectController.list);
router.post('/class-subjects', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.manage'), validate(classSubjectCreateSchema), classSubjectController.create);
router.put('/class-subjects/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.manage'), validate(classSubjectUpdateSchema), classSubjectController.update);
router.delete('/class-subjects/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.manage'), classSubjectController.delete);

// ─── Grades (Admin/Teacher) ─────────────────────────────
router.get('/grades', AuthMiddleware.verifyToken, AuthMiddleware.authorize('grades.view', ['teacher']), gradeController.list);
router.get('/grade-types', AuthMiddleware.verifyToken, AuthMiddleware.authorize('grades.view', ['teacher']), gradeController.listGradeTypes);
router.post('/grades', AuthMiddleware.verifyToken, AuthMiddleware.authorize('grades.manage', ['teacher']), validate(gradeCreateSchema), gradeController.create);
router.put('/grades/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('grades.manage', ['teacher']), validate(gradeUpdateSchema), gradeController.update);
router.delete('/grades/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('grades.manage'), gradeController.delete);

// ─── Cards (Admin) ──────────────────────────────────────
router.get('/cards', AuthMiddleware.verifyToken, AuthMiddleware.authorize('cards.view'), cardController.list);
router.post('/cards', AuthMiddleware.verifyToken, AuthMiddleware.authorize('cards.manage'), validate(cardCreateSchema), cardController.create);
router.put('/cards/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('cards.manage'), validate(cardUpdateSchema), cardController.update);
router.delete('/cards/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('cards.manage'), cardController.delete);

// ─── Top-Up Requests ────────────────────────────────────
router.get('/topup-requests', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.view', ['parent']), topUpController.list);
router.post('/topup-requests', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), validate(topUpCreateSchema), topUpController.create);
router.put('/topup-requests/:id/approve', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.topups_approve'), topUpController.approve);
router.put('/topup-requests/:id/reject', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.topups_approve'), validate(topUpRejectSchema), topUpController.reject);

// ─── Shops ──────────────────────────────────────────────
router.get('/shops', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.view'), shopController.list);
router.post('/shops', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.shops_manage'), validate(shopCreateSchema), shopController.create);
router.put('/shops/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.shops_manage'), validate(shopUpdateSchema), shopController.update);
router.delete('/shops/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.shops_manage'), shopController.delete);

// ─── Notifications ──────────────────────────────────────
router.get('/notifications', AuthMiddleware.verifyToken, AuthMiddleware.authorize('notifications.manage'), notificationController.list);
router.post('/notifications', AuthMiddleware.verifyToken, AuthMiddleware.authorize('notifications.manage'), validate(notificationCreateSchema), notificationController.create);
router.put('/notifications/:id/delivered', AuthMiddleware.verifyToken, AuthMiddleware.authorize('notifications.manage'), notificationController.markDelivered);

// ─── Spending Limits ────────────────────────────────────
router.get('/spending-limits/:studentId', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.view', ['parent']), spendingLimitController.getByStudent);
router.put('/spending-limits/:studentId', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.limits_manage'), validate(spendingLimitUpsertSchema), spendingLimitController.upsert);

// ─── Settings (Admin) ─────────────────────────────────────
router.get('/settings', AuthMiddleware.verifyToken, AuthMiddleware.authorize('settings.manage'), settingsController.get);
router.put('/settings', AuthMiddleware.verifyToken, AuthMiddleware.authorize('settings.manage'), validate(settingsSaveSchema), settingsController.save);

// ─── Announcements (Admin/Teacher) ────────────────────────
import announcementController from '../../interfaces/controllers/AnnouncementController';
router.get('/announcements', AuthMiddleware.verifyToken, announcementController.list);
router.get('/announcements/:id', AuthMiddleware.verifyToken, announcementController.get);
router.post('/announcements', AuthMiddleware.verifyToken, AuthMiddleware.authorize('announcements.manage', ['teacher']), validate(announcementCreateSchema), announcementController.create);
router.put('/announcements/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('announcements.manage', ['teacher']), validate(announcementUpdateSchema), announcementController.update);
router.delete('/announcements/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('announcements.manage', ['teacher']), announcementController.delete);

// ─── Academic Terms ─────────────────────────────────────
router.get('/academic-terms', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.view', ['teacher', 'parent']), academicTermController.list);
router.get('/academic-terms/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.view'), academicTermController.get);
router.post('/academic-terms', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.manage'), validate(academicTermCreateSchema), academicTermController.create);
router.put('/academic-terms/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.manage'), validate(academicTermUpdateSchema), academicTermController.update);
router.delete('/academic-terms/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.manage'), academicTermController.delete);

// ─── Reports (Admin) ────────────────────────────────────
router.get('/reports/attendance', AuthMiddleware.verifyToken, AuthMiddleware.authorize('reports.view'), validate(attendanceReportQuerySchema, 'query'), reportController.attendance);
router.post('/reports/attendance/notify', AuthMiddleware.verifyToken, AuthMiddleware.authorize('attendance.manage'), validate(absenceNotifySchema), reportController.notifyAbsence);

// ─── Fees ───────────────────────────────────────────────
router.get('/fee-types', AuthMiddleware.verifyToken, AuthMiddleware.authorize('fees.view'), feeController.listTypes);
router.post('/fee-types', AuthMiddleware.verifyToken, AuthMiddleware.authorize('fees.manage'), validate(feeTypeCreateSchema), feeController.createType);
router.put('/fee-types/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('fees.manage'), validate(feeTypeUpdateSchema), feeController.updateType);
router.delete('/fee-types/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('fees.manage'), feeController.deleteType);
router.get('/fee-structures', AuthMiddleware.verifyToken, AuthMiddleware.authorize('fees.view'), feeController.listStructures);
router.post('/fee-structures', AuthMiddleware.verifyToken, AuthMiddleware.authorize('fees.manage'), validate(feeStructureCreateSchema), feeController.createStructure);
router.put('/fee-structures/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('fees.manage'), validate(feeStructureUpdateSchema), feeController.updateStructure);
router.delete('/fee-structures/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('fees.manage'), feeController.deleteStructure);
router.post('/fee-structures/:id/generate', AuthMiddleware.verifyToken, AuthMiddleware.authorize('fees.manage'), feeController.generateInvoices);
router.get('/invoices', AuthMiddleware.verifyToken, AuthMiddleware.authorize('fees.view'), feeController.listInvoices);
router.get('/invoices/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('fees.view'), feeController.getInvoice);
router.put('/invoices/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('fees.manage'), validate(invoiceUpdateSchema), feeController.updateInvoice);
router.post('/invoices/:id/void', AuthMiddleware.verifyToken, AuthMiddleware.authorize('fees.manage'), validate(invoiceVoidSchema), feeController.voidInvoice);
router.post('/invoices/:id/payments', AuthMiddleware.verifyToken, AuthMiddleware.authorize('fees.collect'), validate(feePaymentSchema), feeController.recordPayment);
router.get('/reports/fees', AuthMiddleware.verifyToken, AuthMiddleware.authorize(['fees.view', 'reports.view']), feeController.report);
router.get('/parents/me/children/:studentId/invoices', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), feeController.childInvoices);

// ─── Audit Logs (Admin) ─────────────────────────────────
router.get('/audit-logs', AuthMiddleware.verifyToken, AuthMiddleware.authorize('audit.view'), auditLogController.list);

export default router;
