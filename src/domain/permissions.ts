/**
 * Every permission the admin portal checks. Routes are guarded by these keys
 * (AuthMiddleware.authorize); roles are granted them in role_permissions.
 *
 * The built-in "admin" role implicitly holds all of them. Staff roles such as a
 * bursar or registrar get a subset. Teacher and parent portals are not
 * permission-based: their routes are scoped to the signed-in teacher/parent.
 */
export const PERMISSION_GROUPS = {
  overview: ['dashboard.view', 'reports.view', 'reports.export'],
  people: [
    'students.view', 'students.manage', 'students.export', 'teachers.view', 'teachers.manage', 'teachers.export', 'teachers.leave_manage',
    'parents.view', 'parents.manage', 'parents.export',
  ],
  attendance: ['cards.view', 'cards.manage', 'cards.export', 'attendance.manage', 'attendance.manual_tap', 'leave.manage'],
  academics: ['academics.view', 'academics.manage', 'grades.view', 'grades.manage'],
  finance: [
    'finance.view', 'finance.manage', 'finance.payroll_manage', 'finance.topups_approve', 'finance.wallets_manage', 'finance.shops_manage',
    'finance.limits_manage', 'finance.pos',
  ],
  fees: ['fees.view', 'fees.manage', 'fees.collect'],
  communication: ['announcements.manage', 'notifications.manage'],
  system: ['users.manage', 'roles.manage', 'settings.manage', 'audit.view'],
  behavior: ['behavior.view', 'behavior.manage'],
  transport: ['transport.view', 'transport.manage'],
  library: ['library.view', 'library.manage'],
  analytics: ['analytics.at_risk_view', 'analytics.at_risk_manage'],
  assignments: ['assignments.view', 'assignments.manage'],
} as const;

export type Permission = (typeof PERMISSION_GROUPS)[keyof typeof PERMISSION_GROUPS][number];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSION_GROUPS).flat() as Permission[];

export const isPermission = (value: string): value is Permission => (ALL_PERMISSIONS as string[]).includes(value);

/** The role that always holds every permission (so the school can never lock itself out). */
export const SUPER_ROLE = 'admin';
