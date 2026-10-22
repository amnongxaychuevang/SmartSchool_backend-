import { Router  } from 'express';
import rateLimit from 'express-rate-limit';
const router = Router();

// Controllers
import authController from '../../interfaces/controllers/AuthController';
import attendanceController from '../../interfaces/controllers/AttendanceController';
import walletController from '../../interfaces/controllers/WalletController';
import walletAdminController from '../../interfaces/controllers/WalletAdminController';
import studentController from '../../interfaces/controllers/StudentController';
import ethnicityController from '../../interfaces/controllers/EthnicityController';
import provinceController from '../../interfaces/controllers/ProvinceController';
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
import promotionController from '../../interfaces/controllers/PromotionController';
import schoolEventController from '../../interfaces/controllers/SchoolEventController';
import receiptController from '../../interfaces/controllers/ReceiptController';
import behaviorController from '../../interfaces/controllers/BehaviorController';
import busController from '../../interfaces/controllers/BusController';
import libraryController from '../../interfaces/controllers/LibraryController';
import assignmentController from '../../interfaces/controllers/AssignmentController';
import schoolReportController from '../../interfaces/controllers/SchoolReportController';
import exportController from '../../interfaces/controllers/ExportController';
import reportExportController from '../../interfaces/controllers/ReportExportController';
import teacherLeaveController from '../../interfaces/controllers/TeacherLeaveController';
import riskAnalyticsController from '../../interfaces/controllers/RiskAnalyticsController';
import chatController from '../../interfaces/controllers/ChatController';
import payrollController from '../../interfaces/controllers/PayrollController';
import expenseController from '../../interfaces/controllers/ExpenseController';

// Middlewares
import AuthMiddleware from '../../interfaces/middlewares/AuthMiddleware';
import validate from '../../interfaces/middlewares/validate';
import uploadImage from '../../interfaces/middlewares/uploadImage';
import uploadPdf from '../../interfaces/middlewares/uploadPdf';
import uploadAssignment from '../../interfaces/middlewares/uploadAssignment';
import { saveSlip, savePaymentQr } from '../../infrastructure/storage/PhotoStorage';
import {
  loginSchema, refreshTokenSchema, logoutSchema, attendanceScanSchema,
  changePasswordSchema, forgotPasswordSchema, resetPasswordSchema, walletRefundSchema,
  promotionPreviewSchema, promotionApplySchema, calendarQuerySchema, schoolEventSchema,
  dailyAttendanceQuerySchema, dailyAttendanceSaveSchema, attendanceReportQuerySchema, absenceNotifySchema,
  walletProcessSchema, walletTopUpSchema, walletStatusUpdateSchema,
  topUpCreateSchema, topUpRejectSchema,
  studentCreateSchema, studentUpdateSchema,
  userCreateSchema, userUpdateSchema, teacherAccountSchema,
  teacherCreateSchema, teacherUpdateSchema,
  parentCreateSchema, parentUpdateSchema,
  classCreateSchema, classUpdateSchema,
  subjectCreateSchema, subjectUpdateSchema,
  gradeCreateSchema, gradeUpdateSchema,
  cardCreateSchema, cardUpdateSchema,
  shopCreateSchema, shopUpdateSchema, shopRentalPaymentCreateSchema, recordShopRentalPaymentSchema,
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
  behaviorCategorySchema, behaviorRecordCreateSchema, behaviorRecordUpdateSchema,
  busVehicleSchema, busRouteSchema, busStudentAssignSchema, busScanSchema,
  bookCategorySchema, bookCreateSchema, bookUpdateSchema, bookBorrowSchema,
  riskInterventionSchema,
  assignmentCreateSchema, assignmentUpdateSchema,
  teacherLeaveCreateSchema, teacherLeaveDecisionSchema,
  generatePayrollSchema, updatePayrollItemSchema, updatePayrollPeriodStatusSchema,
  expenseCategoryCreateSchema, expenseCategoryUpdateSchema,
  expenseCreateSchema, expenseUpdateSchema,
} from '../../interfaces/validators/schemas';

// Strict limiter for credential-guessing-prone / abuse-prone endpoints.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  // Only failed attempts count: guessing is still capped at 10, but people who sign in
  // correctly (several staff behind one school IP) are never locked out.
  skipSuccessfulRequests: true,
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

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts, please try again later' },
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
router.post('/auth/change-password', AuthMiddleware.verifyToken, loginLimiter, validate(changePasswordSchema), authController.changePassword);
// Forgotten password: every request counts (the answer is always "ok", so skipSuccessfulRequests would not limit it).
router.post('/auth/forgot-password', resetLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/auth/reset-password', resetLimiter, validate(resetPasswordSchema), authController.resetPassword);

// ─── Dashboard (Admin) ──────────────────────────────────
router.get('/dashboard/stats', AuthMiddleware.verifyToken, AuthMiddleware.authorize('dashboard.view'), dashboardController.stats);
router.get('/dashboard/finance/overview', AuthMiddleware.verifyToken, AuthMiddleware.authorize('dashboard.view'), dashboardController.financeOverview);
router.get('/dashboard/classes/top-performers', AuthMiddleware.verifyToken, AuthMiddleware.authorize('dashboard.view'), dashboardController.topPerformers);
router.get('/dashboard/announcements', AuthMiddleware.verifyToken, AuthMiddleware.authorize('dashboard.view'), dashboardController.announcements);
router.get('/dashboard/events/upcoming', AuthMiddleware.verifyToken, AuthMiddleware.authorize('dashboard.view'), dashboardController.upcomingEvents);

// ─── Students (Admin/Teacher) ───────────────────────────
// Reference data used across pages (any signed-in user).
router.get('/ethnicities', AuthMiddleware.verifyToken, ethnicityController.list);
router.get('/provinces', AuthMiddleware.verifyToken, provinceController.list);

router.get('/students/export', AuthMiddleware.verifyToken, AuthMiddleware.authorize('students.export'), exportController.students);
router.get('/students', AuthMiddleware.verifyToken, AuthMiddleware.authorize('students.view', ['teacher']), studentController.list);
router.get('/students/meta/statuses', AuthMiddleware.verifyToken, AuthMiddleware.authorize('students.view', ['teacher']), studentController.getStatuses);
router.get('/students/meta/blood-types', AuthMiddleware.verifyToken, AuthMiddleware.authorize('students.view', ['teacher']), studentController.getBloodTypes);
router.get('/students/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('students.view', ['teacher']), studentController.get);
router.post('/students', AuthMiddleware.verifyToken, AuthMiddleware.authorize('students.manage', ['teacher']), validate(studentCreateSchema), studentController.create);
router.put('/students/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('students.manage', ['teacher']), validate(studentUpdateSchema), studentController.update);
router.post('/students/:id/photo', AuthMiddleware.verifyToken, AuthMiddleware.authorize('students.manage'), uploadImage('photo'), studentController.uploadPhoto);
router.delete('/students/:id/photo', AuthMiddleware.verifyToken, AuthMiddleware.authorize('students.manage'), studentController.deletePhoto);


// ─── Users (Admin) ──────────────────────────────────────
router.get('/users', AuthMiddleware.verifyToken, AuthMiddleware.authorize('users.manage'), userController.list);
router.post('/users', AuthMiddleware.verifyToken, AuthMiddleware.authorize('users.manage'), validate(userCreateSchema), userController.create);
router.get('/users/teacher-candidates', AuthMiddleware.verifyToken, AuthMiddleware.authorize('users.manage'), userController.teacherCandidates);
router.post('/users/teacher-account', AuthMiddleware.verifyToken, AuthMiddleware.authorize('users.manage'), validate(teacherAccountSchema), userController.openTeacherAccount);
router.put('/users/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('users.manage'), validate(userUpdateSchema), userController.update);

// ─── Roles ──────────────────────────────────────────────
router.get('/roles', AuthMiddleware.verifyToken, AuthMiddleware.authorize(['users.manage', 'roles.manage']), roleController.list);
router.get('/permissions', AuthMiddleware.verifyToken, AuthMiddleware.authorize('roles.manage'), roleController.catalog);
router.post('/roles', AuthMiddleware.verifyToken, AuthMiddleware.authorize('roles.manage'), validate(roleCreateSchema), roleController.create);
router.put('/roles/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('roles.manage'), validate(roleUpdateSchema), roleController.update);
router.delete('/roles/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('roles.manage'), roleController.delete);

// ─── Teachers (Admin) ───────────────────────────────────
router.get('/teachers/export', AuthMiddleware.verifyToken, AuthMiddleware.authorize('teachers.export'), exportController.teachers);
router.get('/teachers', AuthMiddleware.verifyToken, AuthMiddleware.authorize('teachers.view'), teacherController.list);
router.post('/teachers', AuthMiddleware.verifyToken, AuthMiddleware.authorize('teachers.manage'), validate(teacherCreateSchema), teacherController.create);
router.get('/teachers/options', AuthMiddleware.verifyToken, AuthMiddleware.authorize(['academics.manage', 'teachers.view']), teacherController.options);
router.get('/teachers/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('teachers.view'), teacherController.get);
router.put('/teachers/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('teachers.manage'), validate(teacherUpdateSchema), teacherController.update);
router.post('/teachers/:id/photo', AuthMiddleware.verifyToken, AuthMiddleware.authorize('teachers.manage'), uploadImage('photo'), teacherController.uploadPhoto);
router.delete('/teachers/:id/photo', AuthMiddleware.verifyToken, AuthMiddleware.authorize('teachers.manage'), teacherController.deletePhoto);
// Signed contracts: private files, streamed only after auth + permission checks.
router.get('/teachers/:id/documents', AuthMiddleware.verifyToken, AuthMiddleware.authorize('teachers.view'), teacherController.listDocuments);
router.post('/teachers/:id/documents', AuthMiddleware.verifyToken, AuthMiddleware.authorize('teachers.manage'), uploadPdf('file'), teacherController.uploadDocument);
router.get('/teachers/:id/documents/:documentId/file', AuthMiddleware.verifyToken, AuthMiddleware.authorize('teachers.view'), teacherController.downloadDocument);
router.delete('/teachers/:id/documents/:documentId', AuthMiddleware.verifyToken, AuthMiddleware.authorize('teachers.manage'), teacherController.deleteDocument);

// ─── Parents (Admin) ────────────────────────────────────
router.get('/parents/export', AuthMiddleware.verifyToken, AuthMiddleware.authorize('parents.export'), exportController.parents);
router.get('/parents', AuthMiddleware.verifyToken, AuthMiddleware.authorize('parents.view'), parentController.list);
router.get('/parents/options', AuthMiddleware.verifyToken, AuthMiddleware.authorize(['students.manage', 'parents.view']), parentController.options);
router.post('/parents', AuthMiddleware.verifyToken, AuthMiddleware.authorize('parents.manage'), validate(parentCreateSchema), parentController.create);
router.get('/parents/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('parents.view'), parentController.get);
router.put('/parents/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('parents.manage'), validate(parentUpdateSchema), parentController.update);
router.post('/parents/:id/photo', AuthMiddleware.verifyToken, AuthMiddleware.authorize('parents.manage'), uploadImage('photo'), parentController.uploadPhoto);
router.delete('/parents/:id/photo', AuthMiddleware.verifyToken, AuthMiddleware.authorize('parents.manage'), parentController.deletePhoto);

// ─── Parents (Parent Portal) ────────────────────────────
router.get('/parents/me/announcements', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), parentController.getAnnouncements);
router.get('/parents/me/children', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), parentController.getMyChildren);
router.get('/parents/me/payment-info', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), parentController.getPaymentInfo);
router.get('/parents/me/children/:studentId/attendance', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), parentController.getChildAttendance);
router.get('/parents/me/children/:studentId/grades', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), parentController.getChildGrades);
router.get('/parents/me/children/:studentId/wallet', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), parentController.getChildWallet);
router.get('/parents/me/children/:studentId/behavior', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), parentController.getChildBehavior);
router.get('/parents/me/children/:studentId/transport', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), parentController.getChildTransport);
router.get('/parents/me/children/:studentId/library', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), parentController.getChildLibrary);
router.get('/parents/me/children/:studentId/assignments', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), parentController.getChildAssignments);
router.get('/parents/me/children/:studentId/schedule', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), parentController.getChildSchedule);
router.get('/parents/me/children/:studentId/leave-requests', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), parentController.getLeaveRequests);
router.post('/parents/me/children/:studentId/leave-requests', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), validate(leaveRequestCreateSchema), parentController.createLeaveRequest);
router.get('/parents/me/children/:studentId/spending-limits', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), parentController.getSpendingLimits);
router.put('/parents/me/children/:studentId/spending-limits', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), validate(spendingLimitUpsertSchema), parentController.updateSpendingLimits);
router.get('/parents/me/children/:studentId/cards', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), parentController.getChildCards);
router.post('/parents/me/children/:studentId/cards/:cardId/report-lost', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), parentController.reportCardLost);

// ─── Classes (Admin/Teacher) ────────────────────────────
router.get('/classes', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.view', ['teacher']), classController.list);
router.get('/classes/all', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.view', ['teacher']), classController.listAll);
router.get('/classes/academic-years', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.view'), classController.academicYears);
router.get('/classes/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.view'), classController.get);
router.post('/classes', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.manage'), validate(classCreateSchema), classController.create);
router.put('/classes/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.manage'), validate(classUpdateSchema), classController.update);
router.delete('/classes/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.manage'), classController.delete);

// ─── Receipts (printable / save as PDF) ─────────────────
router.get('/receipts/fee/:paymentId', AuthMiddleware.verifyToken, AuthMiddleware.authorize('fees.view', ['parent']), receiptController.feePayment);
router.get('/receipts/topup/:transactionId', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.view', ['parent']), receiptController.topUp);

// ─── School calendar ────────────────────────────────────
router.get('/calendar', AuthMiddleware.verifyToken, validate(calendarQuerySchema, 'query'), schoolEventController.list);
router.post('/calendar', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.manage'), validate(schoolEventSchema), schoolEventController.create);
router.put('/calendar/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.manage'), validate(schoolEventSchema), schoolEventController.update);
router.delete('/calendar/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.manage'), schoolEventController.delete);

// ─── Year-end promotion ─────────────────────────────────
// Moves students between years and changes their status: both class and student rights are needed.
router.get('/promotion/preview', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.manage'), validate(promotionPreviewSchema, 'query'), promotionController.preview);
router.post('/promotion/apply', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.manage'), AuthMiddleware.authorize('students.manage'), validate(promotionApplySchema), promotionController.apply);

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
router.post('/attendance/auto-absence/run', AuthMiddleware.verifyToken, AuthMiddleware.authorize('attendance.manage'), attendanceController.runAutoAbsence);

// ─── Wallet (shop purchase) ─────────────────────────────
router.get('/wallet/card/:uid', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.pos'), walletController.lookupCard);
router.post('/wallet/process', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.pos'), validate(walletProcessSchema), walletController.processTransaction);

// ─── Wallet Admin ───────────────────────────────────────
router.get('/wallets', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.view'), walletAdminController.listWallets);
router.get('/wallets/student/:studentId', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.view'), walletAdminController.getWalletByStudent);
router.get('/wallets/:walletId/transactions', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.view'), walletAdminController.listTransactions);
router.post('/wallets/:walletId/topup', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.wallets_manage'), validate(walletTopUpSchema), walletAdminController.topUp);
router.put('/wallets/:walletId/status', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.wallets_manage'), validate(walletStatusUpdateSchema), walletAdminController.updateStatus);
router.post('/wallet-transactions/:transactionId/refund', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.wallets_manage'), validate(walletRefundSchema), walletAdminController.refund);

// ─── Subjects (Admin/Teacher) ───────────────────────────
router.get('/subjects', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.view', ['teacher']), subjectController.list);
router.get('/subjects/all', AuthMiddleware.verifyToken, AuthMiddleware.authorize('academics.view', ['teacher']), subjectController.listAll);
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
router.delete('/grades/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('grades.manage', ['teacher']), gradeController.delete);

// ─── Cards (Admin) ──────────────────────────────────────
router.get('/cards/export', AuthMiddleware.verifyToken, AuthMiddleware.authorize('cards.export'), exportController.cards);
router.get('/cards', AuthMiddleware.verifyToken, AuthMiddleware.authorize('cards.view'), cardController.list);
router.post('/cards', AuthMiddleware.verifyToken, AuthMiddleware.authorize('cards.manage'), validate(cardCreateSchema), cardController.create);
router.put('/cards/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('cards.manage'), validate(cardUpdateSchema), cardController.update);
router.delete('/cards/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('cards.manage'), cardController.delete);

// ─── Top-Up Requests ────────────────────────────────────
router.get('/topup-requests', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.view', ['parent']), topUpController.list);
router.post('/topup-requests', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), validate(topUpCreateSchema), topUpController.create);
router.put('/topup-requests/:id/approve', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.topups_approve'), topUpController.approve);
router.put('/topup-requests/:id/reject', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.topups_approve'), validate(topUpRejectSchema), topUpController.reject);

// ─── Slip Upload ───────────────────────────────────────
router.post('/uploads/slip', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), uploadImage('slip'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const url = await saveSlip(req.file.buffer);
    res.json({ success: true, data: { url } });
  } catch (error) {
    next(error);
  }
});

// ─── Shops & Rentals ─────────────────────────────────────
router.get('/shops/rentals', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.view'), shopController.listRentals);
router.post('/shops/rentals/:rentalId/pay', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.shops_manage'), validate(recordShopRentalPaymentSchema), shopController.recordPayment);
router.post('/shops/rentals/:rentalId/slip', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.shops_manage'), uploadImage('slip'), shopController.uploadSlip);
router.delete('/shops/rentals/:rentalId/slip', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.shops_manage'), shopController.deleteSlip);
router.delete('/shops/rentals/:rentalId', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.shops_manage'), shopController.deleteRental);

router.get('/shops', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.view'), shopController.list);
router.get('/shops/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.view'), shopController.get);
router.get('/shops/:id/rentals', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.view'), shopController.listRentals);
router.post('/shops/:id/rentals', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.shops_manage'), validate(shopRentalPaymentCreateSchema), shopController.createRental);
router.post('/shops', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.shops_manage'), validate(shopCreateSchema), shopController.create);
router.put('/shops/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.shops_manage'), validate(shopUpdateSchema), shopController.update);
router.delete('/shops/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.shops_manage'), shopController.delete);

// ─── Notifications ──────────────────────────────────────
router.get('/notifications', AuthMiddleware.verifyToken, AuthMiddleware.authorize('notifications.manage'), notificationController.list);
router.post('/notifications', AuthMiddleware.verifyToken, AuthMiddleware.authorize('notifications.manage'), validate(notificationCreateSchema), notificationController.create);
router.put('/notifications/:id/delivered', AuthMiddleware.verifyToken, AuthMiddleware.authorize('notifications.manage'), notificationController.markDelivered);

// User In-App Notifications
router.get('/notifications/my', AuthMiddleware.verifyToken, notificationController.getMyNotifications);
router.get('/notifications/unread-count', AuthMiddleware.verifyToken, notificationController.getUnreadCount);
router.put('/notifications/:id/read', AuthMiddleware.verifyToken, notificationController.markRead);
router.put('/notifications/read-all', AuthMiddleware.verifyToken, notificationController.markAllRead);

// ─── Spending Limits ────────────────────────────────────
router.get('/spending-limits/:studentId', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.view', ['parent']), spendingLimitController.getByStudent);
router.put('/spending-limits/:studentId', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.limits_manage'), validate(spendingLimitUpsertSchema), spendingLimitController.upsert);

// ─── Settings (Admin) ─────────────────────────────────────
router.get('/settings', AuthMiddleware.verifyToken, AuthMiddleware.authorize('settings.manage'), settingsController.get);
router.put('/settings', AuthMiddleware.verifyToken, AuthMiddleware.authorize('settings.manage'), validate(settingsSaveSchema), settingsController.save);
router.post('/settings/payment-qr', AuthMiddleware.verifyToken, AuthMiddleware.authorize('settings.manage'), uploadImage('qr'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    res.json({ success: true, data: { url: await savePaymentQr(req.file.buffer) } });
  } catch (error) {
    next(error);
  }
});

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
// ─── Report exports (one standard: report filters, bilingual .xlsx, audit-logged) ───
const reportExport = [AuthMiddleware.verifyToken, AuthMiddleware.authorize('reports.export')];
router.get('/reports/attendance/export', ...reportExport, reportExportController.attendance);
router.get('/reports/grades/export', ...reportExport, reportExportController.grades);
router.get('/reports/wallet/export', ...reportExport, reportExportController.wallet);
router.get('/reports/fees/export', ...reportExport, reportExportController.fees);
router.get('/reports/fees/debtors/export', ...reportExport, reportExportController.debtors);
router.get('/reports/daily-cash/export', ...reportExport, reportExportController.dailyCash);
router.get('/reports/class-results/export', ...reportExport, reportExportController.classResults);
router.get('/reports/students', AuthMiddleware.verifyToken, AuthMiddleware.authorize('reports.view'), schoolReportController.studentStats);

router.get('/reports/attendance', AuthMiddleware.verifyToken, AuthMiddleware.authorize('reports.view'), validate(attendanceReportQuerySchema, 'query'), reportController.attendance);
router.post('/reports/attendance/notify', AuthMiddleware.verifyToken, AuthMiddleware.authorize('attendance.manage'), validate(absenceNotifySchema), reportController.notifyAbsence);
router.get('/reports/shop-sales', AuthMiddleware.verifyToken, AuthMiddleware.authorize(['finance.view', 'reports.view']), reportController.shopSales);
router.get('/reports/cashflow', AuthMiddleware.verifyToken, AuthMiddleware.authorize(['finance.view', 'reports.view']), schoolReportController.cashflow);

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
router.post('/fees/reminders/run', AuthMiddleware.verifyToken, AuthMiddleware.authorize('fees.manage'), feeController.runReminders);
router.get('/invoices', AuthMiddleware.verifyToken, AuthMiddleware.authorize('fees.view'), feeController.listInvoices);
router.get('/invoices/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('fees.view'), feeController.getInvoice);
router.put('/invoices/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('fees.manage'), validate(invoiceUpdateSchema), feeController.updateInvoice);
router.post('/invoices/:id/void', AuthMiddleware.verifyToken, AuthMiddleware.authorize('fees.manage'), validate(invoiceVoidSchema), feeController.voidInvoice);
router.post('/invoices/:id/payments', AuthMiddleware.verifyToken, AuthMiddleware.authorize('fees.collect'), validate(feePaymentSchema), feeController.recordPayment);
router.get('/reports/fees', AuthMiddleware.verifyToken, AuthMiddleware.authorize(['fees.view', 'reports.view']), feeController.report);
router.get('/reports/fees/debtors', AuthMiddleware.verifyToken, AuthMiddleware.authorize(['fees.view', 'reports.view']), schoolReportController.debtors);
router.get('/reports/daily-cash', AuthMiddleware.verifyToken, AuthMiddleware.authorize(['fees.view', 'finance.view', 'reports.view']), schoolReportController.dailyCash);
router.get('/reports/class-results', AuthMiddleware.verifyToken, AuthMiddleware.authorize(['grades.view', 'reports.view']), schoolReportController.classResults);
router.get('/reports/fees/payments', AuthMiddleware.verifyToken, AuthMiddleware.authorize(['fees.view', 'reports.view']), feeController.reportPayments);
router.get('/parents/me/children/:studentId/invoices', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['parent']), feeController.childInvoices);

// ─── Audit Logs (Admin) ─────────────────────────────────
router.get('/audit-logs', AuthMiddleware.verifyToken, AuthMiddleware.authorize('audit.view'), auditLogController.list);

// ─── 14. Behavior / Discipline ──────────────────────────
router.get('/behavior/overview', AuthMiddleware.verifyToken, AuthMiddleware.authorize('behavior.view'), behaviorController.getOverview);
router.get('/behavior/categories', AuthMiddleware.verifyToken, AuthMiddleware.authorize('behavior.view', ['teacher']), behaviorController.listCategories);
router.post('/behavior/categories', AuthMiddleware.verifyToken, AuthMiddleware.authorize('behavior.manage'), validate(behaviorCategorySchema), behaviorController.createCategory);
router.put('/behavior/categories/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('behavior.manage'), validate(behaviorCategorySchema.partial()), behaviorController.updateCategory);
router.delete('/behavior/categories/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('behavior.manage'), behaviorController.deleteCategory);
// Teachers: scoped to their own classes, and to records they wrote (see BehaviorController).
router.get('/behavior/records', AuthMiddleware.verifyToken, AuthMiddleware.authorize('behavior.view', ['teacher']), behaviorController.listRecords);
router.post('/behavior/records', AuthMiddleware.verifyToken, AuthMiddleware.authorize('behavior.manage', ['teacher']), validate(behaviorRecordCreateSchema), behaviorController.createRecord);
router.put('/behavior/records/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('behavior.manage', ['teacher']), validate(behaviorRecordUpdateSchema), behaviorController.updateRecord);
router.delete('/behavior/records/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('behavior.manage', ['teacher']), behaviorController.deleteRecord);
router.get('/behavior/students/:studentId', AuthMiddleware.verifyToken, AuthMiddleware.authorize('behavior.view', ['teacher']), behaviorController.getStudentConduct);

// ─── 15. Bus Transportation ─────────────────────────────
router.get('/bus/vehicles', AuthMiddleware.verifyToken, AuthMiddleware.authorize('transport.view'), busController.listVehicles);
router.post('/bus/vehicles', AuthMiddleware.verifyToken, AuthMiddleware.authorize('transport.manage'), validate(busVehicleSchema), busController.createVehicle);
router.put('/bus/vehicles/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('transport.manage'), validate(busVehicleSchema.partial()), busController.updateVehicle);
router.delete('/bus/vehicles/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('transport.manage'), busController.deleteVehicle);

router.get('/bus/routes', AuthMiddleware.verifyToken, AuthMiddleware.authorize('transport.view'), busController.listRoutes);
router.post('/bus/routes', AuthMiddleware.verifyToken, AuthMiddleware.authorize('transport.manage'), validate(busRouteSchema), busController.createRoute);
router.put('/bus/routes/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('transport.manage'), validate(busRouteSchema.partial()), busController.updateRoute);
router.delete('/bus/routes/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('transport.manage'), busController.deleteRoute);

router.get('/bus/students', AuthMiddleware.verifyToken, AuthMiddleware.authorize('transport.view'), busController.listBusStudents);
router.post('/bus/students', AuthMiddleware.verifyToken, AuthMiddleware.authorize('transport.manage'), validate(busStudentAssignSchema), busController.assignStudent);
router.delete('/bus/students/:studentId', AuthMiddleware.verifyToken, AuthMiddleware.authorize('transport.manage'), busController.removeStudent);

router.post('/bus/scan', scanLimiter, validate(busScanSchema), busController.scanBusCard);
router.get('/bus/logs', AuthMiddleware.verifyToken, AuthMiddleware.authorize('transport.view'), busController.listLogs);
router.get('/bus/manifest', AuthMiddleware.verifyToken, AuthMiddleware.authorize('transport.view'), busController.getLiveManifest);

// Bus Live GPS Tracking
router.post('/bus/location', AuthMiddleware.verifyToken, busController.recordLocation);
router.get('/bus/fleet-locations', AuthMiddleware.verifyToken, busController.getFleetLocations);
router.get('/bus/routes/:routeId/live', AuthMiddleware.verifyToken, busController.getRouteLocation);

// ─── 16. Library Management ─────────────────────────────
router.get('/library/overview', AuthMiddleware.verifyToken, AuthMiddleware.authorize('library.view'), libraryController.getOverview);
router.get('/library/categories', AuthMiddleware.verifyToken, AuthMiddleware.authorize('library.view'), libraryController.listCategories);
router.post('/library/categories', AuthMiddleware.verifyToken, AuthMiddleware.authorize('library.manage'), validate(bookCategorySchema), libraryController.createCategory);
router.put('/library/categories/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('library.manage'), validate(bookCategorySchema.partial()), libraryController.updateCategory);
router.delete('/library/categories/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('library.manage'), libraryController.deleteCategory);

router.get('/library/books', AuthMiddleware.verifyToken, AuthMiddleware.authorize('library.view'), libraryController.listBooks);
router.get('/library/books/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('library.view'), libraryController.getBook);
router.post('/library/books', AuthMiddleware.verifyToken, AuthMiddleware.authorize('library.manage'), validate(bookCreateSchema), libraryController.createBook);
router.put('/library/books/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('library.manage'), validate(bookUpdateSchema), libraryController.updateBook);
router.delete('/library/books/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('library.manage'), libraryController.deleteBook);

router.get('/library/loans', AuthMiddleware.verifyToken, AuthMiddleware.authorize('library.view'), libraryController.listLoans);
router.post('/library/borrow', AuthMiddleware.verifyToken, AuthMiddleware.authorize('library.manage'), validate(bookBorrowSchema), libraryController.borrowBook);
router.post('/library/loans/:loanId/renew', AuthMiddleware.verifyToken, AuthMiddleware.authorize('library.manage'), libraryController.renewLoan);
router.post('/library/loans/:loanId/return', AuthMiddleware.verifyToken, AuthMiddleware.authorize('library.manage'), libraryController.returnBook);

// ─── 18. At-Risk Student Analytics ──────────────────────
router.get('/analytics/at-risk/overview', AuthMiddleware.verifyToken, AuthMiddleware.authorize('analytics.at_risk_view'), riskAnalyticsController.getOverview);
router.get('/analytics/at-risk', AuthMiddleware.verifyToken, AuthMiddleware.authorize('analytics.at_risk_view'), riskAnalyticsController.listAtRisk);
router.post('/analytics/at-risk/run', AuthMiddleware.verifyToken, AuthMiddleware.authorize('analytics.at_risk_manage'), riskAnalyticsController.runAssessment);
router.get('/analytics/at-risk/:studentId', AuthMiddleware.verifyToken, AuthMiddleware.authorize('analytics.at_risk_view'), riskAnalyticsController.getStudentRiskDetail);
router.post('/analytics/at-risk/interventions', AuthMiddleware.verifyToken, AuthMiddleware.authorize('analytics.at_risk_manage'), validate(riskInterventionSchema), riskAnalyticsController.createIntervention);
router.put('/analytics/at-risk/interventions/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('analytics.at_risk_manage'), riskAnalyticsController.updateIntervention);

// ─── Teacher leave ──────────────────────────────────────
router.get('/teacher-leaves/me', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['teacher']), teacherLeaveController.listMine);
router.post('/teacher-leaves/me', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['teacher']), validate(teacherLeaveCreateSchema), teacherLeaveController.create);
router.delete('/teacher-leaves/me/:id', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['teacher']), teacherLeaveController.cancel);
router.get('/teacher-leaves', AuthMiddleware.verifyToken, AuthMiddleware.authorize('teachers.leave_manage'), teacherLeaveController.list);
router.put('/teacher-leaves/:id/status', AuthMiddleware.verifyToken, AuthMiddleware.authorize('teachers.leave_manage'), validate(teacherLeaveDecisionSchema), teacherLeaveController.decide);

// ─── Homework / Assignments ─────────────────────────────
router.get('/assignments', AuthMiddleware.verifyToken, AuthMiddleware.authorize('assignments.view', ['teacher']), assignmentController.list);
router.post('/assignments', AuthMiddleware.verifyToken, AuthMiddleware.authorize('assignments.manage', ['teacher']), validate(assignmentCreateSchema), assignmentController.create);
router.put('/assignments/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('assignments.manage', ['teacher']), validate(assignmentUpdateSchema), assignmentController.update);
router.delete('/assignments/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('assignments.manage', ['teacher']), assignmentController.delete);

// Submissions & Grading
router.get('/assignments/:id/submissions', AuthMiddleware.verifyToken, AuthMiddleware.authorize('assignments.view', ['teacher']), assignmentController.listSubmissions);
router.post('/assignments/:id/submit', AuthMiddleware.verifyToken, uploadAssignment('file'), assignmentController.submit);
router.put('/assignments/submissions/:submissionId/grade', AuthMiddleware.verifyToken, AuthMiddleware.authorize('assignments.manage', ['teacher']), assignmentController.grade);
router.get('/assignments/student/:studentId', AuthMiddleware.verifyToken, AuthMiddleware.authorize('assignments.view', ['parent']), assignmentController.listForStudent);

// ─── 18. Teacher-Parent Real-Time Chat ──────────────────────────
router.get('/chat/conversations', AuthMiddleware.verifyToken, chatController.listConversations);
router.post('/chat/conversations', AuthMiddleware.verifyToken, chatController.getOrCreate);
router.get('/chat/conversations/:id/messages', AuthMiddleware.verifyToken, chatController.getMessages);
router.post('/chat/conversations/:id/messages', AuthMiddleware.verifyToken, chatController.sendMessage);
router.put('/chat/conversations/:id/read', AuthMiddleware.verifyToken, chatController.markRead);
router.get('/chat/contacts', AuthMiddleware.verifyToken, chatController.getContacts);

// ─── 19. Teacher Payroll ─────────────────────────────────────────
// Admin endpoints
router.get('/payroll/periods', AuthMiddleware.verifyToken, AuthMiddleware.authorize(['finance.view', 'finance.manage']), payrollController.listPeriods);
router.post('/payroll/periods/generate', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.manage'), validate(generatePayrollSchema), payrollController.generatePeriod);
router.get('/payroll/periods/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize(['finance.view', 'finance.manage']), payrollController.getPeriod);
router.get('/payroll/periods/:id/export', AuthMiddleware.verifyToken, AuthMiddleware.authorize(['finance.view', 'finance.manage']), payrollController.exportBankTransfer);
router.put('/payroll/items/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.manage'), validate(updatePayrollItemSchema), payrollController.updateItem);
router.post('/payroll/items/:id/slip', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.manage'), uploadImage('slip'), payrollController.uploadSlip);
router.delete('/payroll/items/:id/slip', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.manage'), payrollController.deleteSlip);
router.patch('/payroll/periods/:id/status', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.manage'), validate(updatePayrollPeriodStatusSchema), payrollController.updatePeriodStatus);
router.delete('/payroll/periods/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.manage'), payrollController.deletePeriod);

// Teacher Portal endpoints
router.get('/payroll/my-payslips', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['teacher']), payrollController.getMyPayslips);
router.get('/payroll/my-payslips/:id', AuthMiddleware.verifyToken, AuthMiddleware.requireRole(['teacher']), payrollController.getMyPayslip);

// ─── 20. General Operating Expenses ──────────────────────────────
router.get('/expense-categories', AuthMiddleware.verifyToken, AuthMiddleware.authorize(['finance.view', 'finance.manage']), expenseController.listCategories);
router.post('/expense-categories', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.manage'), validate(expenseCategoryCreateSchema), expenseController.createCategory);
router.put('/expense-categories/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.manage'), validate(expenseCategoryUpdateSchema), expenseController.updateCategory);
router.delete('/expense-categories/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.manage'), expenseController.deleteCategory);

router.get('/expenses', AuthMiddleware.verifyToken, AuthMiddleware.authorize(['finance.view', 'finance.manage']), expenseController.listExpenses);
router.get('/expenses/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize(['finance.view', 'finance.manage']), expenseController.getExpense);
router.post('/expenses', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.manage'), validate(expenseCreateSchema), expenseController.createExpense);
router.put('/expenses/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.manage'), validate(expenseUpdateSchema), expenseController.updateExpense);
router.delete('/expenses/:id', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.manage'), expenseController.deleteExpense);
router.post('/expenses/:id/receipt', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.manage'), uploadImage('receipt'), expenseController.uploadReceipt);
router.delete('/expenses/:id/receipt', AuthMiddleware.verifyToken, AuthMiddleware.authorize('finance.manage'), expenseController.deleteReceipt);

export default router;
