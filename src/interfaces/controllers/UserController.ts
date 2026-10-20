import GetUsersUseCase from '../../application/use-cases/users/GetUsersUseCase';
import CreateUserUseCase from '../../application/use-cases/users/CreateUserUseCase';
import UpdateUserUseCase from '../../application/use-cases/users/UpdateUserUseCase';
import OpenTeacherAccountUseCase from '../../application/use-cases/users/OpenTeacherAccountUseCase';
import userAdminRepository from '../../infrastructure/repositories/UserAdminRepository';
import teacherRepository from '../../infrastructure/repositories/TeacherRepository';
import auditLogRepository from '../../infrastructure/repositories/AuditLogRepository';

const getUsersUseCase = new GetUsersUseCase(userAdminRepository);
const createUserUseCase = new CreateUserUseCase(userAdminRepository);
const updateUserUseCase = new UpdateUserUseCase(userAdminRepository);
const openTeacherAccountUseCase = new OpenTeacherAccountUseCase(userAdminRepository);

class UserController {
  async list(req, res, next) {
    try {
      const { role, search = '', page = 1, limit = 20 } = req.query;
      const result = await getUsersUseCase.execute({
        role,
        search,
        page: parseInt(page),
        limit: parseInt(limit),
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const user = await createUserUseCase.execute(req.body);
      res.json({ success: true, data: { user } });
    } catch (error) {
      next(error);
    }
  }

  /** Teachers that have no login account yet. */
  async teacherCandidates(req, res, next) {
    try {
      const teachers = await teacherRepository.findWithoutAccount();
      res.json({ success: true, data: { teachers } });
    } catch (error) {
      next(error);
    }
  }

  async openTeacherAccount(req, res, next) {
    try {
      const user = await openTeacherAccountUseCase.execute(req.body);
      auditLogRepository.log({
        userId: req.user?.userId,
        action: 'create',
        entityType: 'user',
        entityId: user.userId,
        detail: { teacherId: req.body.teacherId, roleId: req.body.roleId },
        ipAddress: req.ip,
      });
      res.status(201).json({ success: true, data: { user } });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      if (req.body.isActive === false && Number(id) === Number(req.user?.userId)) {
        throw Object.assign(new Error('You cannot deactivate your own account'), { statusCode: 400 });
      }
      const user = await updateUserUseCase.execute(id, req.body);
      // Users are deactivated instead of deleted; keep that on the audit trail.
      if (typeof req.body.isActive === 'boolean') {
        auditLogRepository.log({
          userId: req.user?.userId,
          action: 'status_change',
          entityType: 'user',
          entityId: id,
          detail: { isActive: req.body.isActive },
          ipAddress: req.ip,
        });
      }
      res.json({ success: true, data: { user } });
    } catch (error) {
      next(error);
    }
  }
}

export default new UserController();
