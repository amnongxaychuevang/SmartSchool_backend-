/**
 * Every permission the admin portal checks. Routes are guarded by these keys
 * (AuthMiddleware.authorize); roles are granted them in role_permissions.
 *
 * The built-in "admin" role implicitly holds all of them. Staff roles such as a
 * bursar or registrar get a subset. Teacher and parent portals are not
 * permission-based: their routes are scoped to the signed-in teacher/parent.
 */
export const PERMISSION_GROUPS = {
  overview: ['dashboard.view', 'reports.view'],
  people: ['students.view', 'students.manage', 'teachers.view', 'teachers.manage', 'parents.view', 'parents.manage'],
  attendance: ['cards.view', 'cards.manage', 'attendance.manage', 'attendance.manual_tap', 'leave.manage'],
  academics: ['academics.view', 'academics.manage', 'grades.view', 'grades.manage'],
  finance: [
    'finance.view', 'finance.topups_approve', 'finance.wallets_manage', 'finance.shops_manage',
    'finance.limits_manage', 'finance.pos',
  ],
  fees: ['fees.view', 'fees.manage', 'fees.collect'],
  communication: ['announcements.manage', 'notifications.manage'],
  system: ['users.manage', 'roles.manage', 'settings.manage', 'audit.view'],
} as const;

export type Permission = (typeof PERMISSION_GROUPS)[keyof typeof PERMISSION_GROUPS][number];

export const ALL_PERMISSIONS: Permission[] = Object.values(PERMISSION_GROUPS).flat() as Permission[];

export const isPermission = (value: string): value is Permission => (ALL_PERMISSIONS as string[]).includes(value);

/** The role that always holds every permission (so the school can never lock itself out). */
export const SUPER_ROLE = 'admin';
