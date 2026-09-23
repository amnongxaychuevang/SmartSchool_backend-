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
import genderController from '../../interfaces/controllers/GenderController';
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
import auditLogController from '../../interfaces/controllers/AuditLogController';

// Middlewares
import AuthMiddleware from '../../interfaces/middlewares/AuthMiddleware';
import validate from '../../interfaces/middlewares/validate';
import {
  loginSchema, refreshTokenSchema, logoutSchema, attendanceScanSchema,
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
  settingsSaveSchema,
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
router.get('/dashboard/stats', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), dashboardController.stats);

// ─── Students (Admin/Teacher) ───────────────────────────
router.get('/students', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin', 'teacher']), studentController.list);
router.post('/students', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin', 'teacher']), validate(studentCreateSchema), studentController.create);
router.put('/students/:id', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin', 'teacher']), validate(studentUpdateSchema), studentController.update);
router.delete('/students/:id', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), studentController.delete);

// ─── Genders (public master data) ───────────────────────
router.get('/genders', AuthMiddleware.verifyToken, genderController.list);

// ─── Users (Admin) ──────────────────────────────────────
router.get('/users', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), userController.list);
router.post('/users', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), validate(userCreateSchema), userController.create);
router.put('/users/:id', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), validate(userUpdateSchema), userController.update);
router.delete('/users/:id', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), userController.delete);

// ─── Roles ──────────────────────────────────────────────
router.get('/roles', AuthMiddleware.verifyToken, roleController.list);

// ─── Teachers (Admin) ───────────────────────────────────
router.get('/teachers', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), teacherController.list);
router.post('/teachers', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), validate(teacherCreateSchema), teacherController.create);
router.put('/teachers/:id', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), validate(teacherUpdateSchema), teacherController.update);
router.delete('/teachers/:id', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), teacherController.delete);

// ─── Parents (Admin) ────────────────────────────────────
router.get('/parents', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), parentController.list);
router.post('/parents', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), validate(parentCreateSchema), parentController.create);
router.put('/parents/:id', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), validate(parentUpdateSchema), parentController.update);
router.delete('/parents/:id', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), parentController.delete);

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
router.get('/classes', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin', 'teacher']), classController.list);
router.post('/classes', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), validate(classCreateSchema), classController.create);
router.put('/classes/:id', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), validate(classUpdateSchema), classController.update);
router.delete('/classes/:id', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), classController.delete);

// ─── Schedules (Teacher) ────────────────────────────────
router.get('/schedules', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['teacher']), scheduleController.list);

// ─── Leave Requests (Teacher) ───────────────────────────
router.get('/leave-requests', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['teacher', 'admin']), leaveRequestController.list);
router.put('/leave-requests/:id/status', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['teacher', 'admin']), validate(leaveRequestStatusUpdateSchema), leaveRequestController.updateStatus);

// ─── Attendance ─────────────────────────────────────────
// Hit by unauthenticated gate hardware — protected by a shared device key instead of a user JWT.
router.post('/attendance/scan', scanLimiter, AuthMiddleware.verifyDeviceKey, validate(attendanceScanSchema), attendanceController.scanCard);

// ─── Wallet (shop purchase) ─────────────────────────────
// No dedicated "cashier/shop-staff" role exists yet, so this is restricted to admin as an
// interim measure. TODO: introduce a proper POS/staff role once that workflow is designed.
router.post('/wallet/process', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), validate(walletProcessSchema), walletController.processTransaction);

// ─── Wallet Admin ───────────────────────────────────────
router.get('/wallets', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), walletAdminController.listWallets);
router.get('/wallets/student/:studentId', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), walletAdminController.getWalletByStudent);
router.get('/wallets/:walletId/transactions', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), walletAdminController.listTransactions);
router.post('/wallets/:walletId/topup', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), validate(walletTopUpSchema), walletAdminController.topUp);
router.put('/wallets/:walletId/status', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), validate(walletStatusUpdateSchema), walletAdminController.updateStatus);

// ─── Subjects (Admin/Teacher) ───────────────────────────
router.get('/subjects', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin', 'teacher']), subjectController.list);
router.post('/subjects', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), validate(subjectCreateSchema), subjectController.create);
router.put('/subjects/:id', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), validate(subjectUpdateSchema), subjectController.update);
router.delete('/subjects/:id', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), subjectController.delete);

// ─── Grades (Admin/Teacher) ─────────────────────────────
router.get('/grades', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin', 'teacher']), gradeController.list);
router.get('/grade-types', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin', 'teacher']), gradeController.listGradeTypes);
router.post('/grades', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin', 'teacher']), validate(gradeCreateSchema), gradeController.create);
router.put('/grades/:id', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin', 'teacher']), validate(gradeUpdateSchema), gradeController.update);
router.delete('/grades/:id', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), gradeController.delete);

// ─── Cards (Admin) ──────────────────────────────────────
router.get('/cards', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), cardController.list);
router.post('/cards', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), validate(cardCreateSchema), cardController.create);
router.put('/cards/:id', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), validate(cardUpdateSchema), cardController.update);
router.delete('/cards/:id', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), cardController.delete);

// ─── Top-Up Requests ────────────────────────────────────
router.get('/topup-requests', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin', 'parent']), topUpController.list);
router.post('/topup-requests', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), validate(topUpCreateSchema), topUpController.create);
router.put('/topup-requests/:id/approve', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), topUpController.approve);
router.put('/topup-requests/:id/reject', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), validate(topUpRejectSchema), topUpController.reject);

// ─── Shops ──────────────────────────────────────────────
router.get('/shops', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), shopController.list);
router.post('/shops', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), validate(shopCreateSchema), shopController.create);
router.put('/shops/:id', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), validate(shopUpdateSchema), shopController.update);
router.delete('/shops/:id', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), shopController.delete);

// ─── Notifications ──────────────────────────────────────
router.get('/notifications', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), notificationController.list);
router.post('/notifications', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), validate(notificationCreateSchema), notificationController.create);
router.put('/notifications/:id/delivered', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), notificationController.markDelivered);

// ─── Spending Limits ────────────────────────────────────
router.get('/spending-limits/:studentId', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin', 'parent']), spendingLimitController.getByStudent);
router.put('/spending-limits/:studentId', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), validate(spendingLimitUpsertSchema), spendingLimitController.upsert);

// ─── Settings (Admin) ─────────────────────────────────────
router.get('/settings', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), settingsController.get);
router.put('/settings', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), validate(settingsSaveSchema), settingsController.save);

// ─── Announcements (Admin/Teacher) ────────────────────────
import announcementController from '../../interfaces/controllers/AnnouncementController';
router.get('/announcements', AuthMiddleware.verifyToken, announcementController.list);
router.get('/announcements/:id', AuthMiddleware.verifyToken, announcementController.get);
router.post('/announcements', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin', 'teacher']), validate(announcementCreateSchema), announcementController.create);
router.put('/announcements/:id', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin', 'teacher']), validate(announcementUpdateSchema), announcementController.update);
router.delete('/announcements/:id', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin', 'teacher']), announcementController.delete);

// ─── Academic Terms ─────────────────────────────────────
router.get('/academic-terms', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin', 'teacher', 'parent']), academicTermController.list);
router.get('/academic-terms/:id', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), academicTermController.get);
router.post('/academic-terms', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), validate(academicTermCreateSchema), academicTermController.create);
router.put('/academic-terms/:id', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), validate(academicTermUpdateSchema), academicTermController.update);
router.delete('/academic-terms/:id', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), academicTermController.delete);

// ─── Audit Logs (Admin) ─────────────────────────────────
router.get('/audit-logs', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['admin']), auditLogController.list);

export default router;
