import prisma from '../database/PrismaClient';
import { ALL_PERMISSIONS, SUPER_ROLE, isPermission, type Permission } from '../../domain/permissions';

export type RolePortal = 'admin' | 'teacher' | 'parent';
export interface RoleAccess {
  portal: RolePortal;
  permissions: Permission[];
  roleNameEn: string;
  roleNameLo: string;
}

// Access per role code, re-read at most every 30 s (and immediately after an edit
// through this repository), so a permission change applies without a restart.
const CACHE_MS = 30_000;
const cache = new Map<string, { access: RoleAccess | null; at: number }>();

class RoleRepository {
  async accessFor(code: string): Promise<RoleAccess | null> {
    const hit = cache.get(code);
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.access;

    const role = await prisma.role.findUnique({
      where: { code },
      select: { portal: true, nameEn: true, nameLo: true, permissions: { select: { permission: true } } },
    });
    const access: RoleAccess | null = role
      ? {
        portal: role.portal,
        roleNameEn: role.nameEn,
        roleNameLo: role.nameLo,
        permissions: code === SUPER_ROLE
          ? [...ALL_PERMISSIONS]
          : role.permissions.map((p) => p.permission).filter(isPermission),
      }
      : null;
    cache.set(code, { access, at: Date.now() });
    return access;
  }

  invalidate() {
    cache.clear();
  }

  async list() {
    const roles = await prisma.role.findMany({
      orderBy: [{ isSystem: 'desc' }, { roleId: 'asc' }],
      include: { permissions: { select: { permission: true } }, _count: { select: { users: true } } },
    });
    return roles.map(({ permissions, _count, ...role }) => ({
      ...role,
      userCount: _count.users,
      permissions: role.code === SUPER_ROLE ? [...ALL_PERMISSIONS] : permissions.map((p) => p.permission).filter(isPermission),
    }));
  }

  async create(data: { code: string; nameEn: string; nameLo: string; permissions: Permission[] }) {
    const role = await prisma.role.create({
      data: {
        code: data.code, nameEn: data.nameEn, nameLo: data.nameLo, portal: 'admin', isSystem: false,
        permissions: { create: data.permissions.map((permission) => ({ permission })) },
      },
    });
    this.invalidate();
    return role;
  }

  async update(roleId: number, data: { nameEn?: string; nameLo?: string; permissions?: Permission[] }) {
    const role = await prisma.role.findUnique({ where: { roleId } });
    if (!role) throw Object.assign(new Error('Role not found'), { statusCode: 404 });

    const { permissions, ...names } = data;
    // Built-in roles keep their permissions: admin has everything, and the
    // teacher/parent portals are scoped by role, not by permission.
    if (permissions && role.isSystem) {
      throw Object.assign(new Error('Permissions of built-in roles cannot be changed'), { statusCode: 422 });
    }
    const updated = await prisma.$transaction(async (tx) => {
      if (permissions) {
        await tx.rolePermission.deleteMany({ where: { roleId } });
        await tx.rolePermission.createMany({ data: [...new Set(permissions)].map((permission) => ({ roleId, permission })) });
      }
      return tx.role.update({ where: { roleId }, data: names });
    });
    this.invalidate();
    return updated;
  }

  async delete(roleId: number) {
    const role = await prisma.role.findUnique({ where: { roleId }, include: { _count: { select: { users: true } } } });
    if (!role) throw Object.assign(new Error('Role not found'), { statusCode: 404 });
    if (role.isSystem) throw Object.assign(new Error('Built-in roles cannot be deleted'), { statusCode: 422 });
    if (role._count.users) throw Object.assign(new Error('Move this role\'s users to another role first'), { statusCode: 409 });
    await prisma.role.delete({ where: { roleId } });
    this.invalidate();
  }
}

export default new RoleRepository();
