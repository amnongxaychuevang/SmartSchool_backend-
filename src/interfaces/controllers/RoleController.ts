import roleRepository from '../../infrastructure/repositories/RoleRepository';
import auditLogRepository from '../../infrastructure/repositories/AuditLogRepository';
import { PERMISSION_GROUPS } from '../../domain/permissions';

const RoleController = {
  // GET /roles — every role with its permissions and how many users hold it.
  async list(req, res, next) {
    try {
      res.json({ success: true, data: await roleRepository.list() });
    } catch (error) {
      next(error);
    }
  },

  // GET /permissions — the catalogue the permissions screen renders, by group.
  async catalog(req, res) {
    res.json({ success: true, data: { groups: PERMISSION_GROUPS } });
  },

  // POST /roles — a new staff role for the admin portal (e.g. bursar, registrar).
  async create(req, res, next) {
    try {
      const role = await roleRepository.create(req.body);
      auditLogRepository.log({
        userId: req.user.userId, action: 'create', entityType: 'role', entityId: role.roleId,
        detail: { code: role.code, permissions: req.body.permissions }, ipAddress: req.ip,
      });
      res.status(201).json({ success: true, data: { role } });
    } catch (error) {
      if (error.code === 'P2002') return res.status(409).json({ success: false, message: 'A role with this code already exists' });
      next(error);
    }
  },

  // PUT /roles/:id — rename, or change a staff role's permissions.
  async update(req, res, next) {
    try {
      const role = await roleRepository.update(Number(req.params.id), req.body);
      auditLogRepository.log({
        userId: req.user.userId, action: 'update', entityType: 'role', entityId: role.roleId,
        detail: req.body, ipAddress: req.ip,
      });
      res.json({ success: true, data: { role } });
    } catch (error) {
      next(error);
    }
  },

  // DELETE /roles/:id — only unused staff roles.
  async delete(req, res, next) {
    try {
      await roleRepository.delete(Number(req.params.id));
      auditLogRepository.log({
        userId: req.user.userId, action: 'delete', entityType: 'role', entityId: Number(req.params.id), ipAddress: req.ip,
      });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },
};

export default RoleController;
