import GetUsersUseCase from '../../application/use-cases/users/GetUsersUseCase';
import CreateUserUseCase from '../../application/use-cases/users/CreateUserUseCase';
import UpdateUserUseCase from '../../application/use-cases/users/UpdateUserUseCase';
import DeleteUserUseCase from '../../application/use-cases/users/DeleteUserUseCase';
import userAdminRepository from '../../infrastructure/repositories/UserAdminRepository';
import auditLogRepository from '../../infrastructure/repositories/AuditLogRepository';

const getUsersUseCase = new GetUsersUseCase(userAdminRepository);
const createUserUseCase = new CreateUserUseCase(userAdminRepository);
const updateUserUseCase = new UpdateUserUseCase(userAdminRepository);
const deleteUserUseCase = new DeleteUserUseCase(userAdminRepository);

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

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const user = await updateUserUseCase.execute(id, req.body);
      res.json({ success: true, data: { user } });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      await deleteUserUseCase.execute(id);
      auditLogRepository.log({
        userId: req.user?.userId,
        action: 'delete',
        entityType: 'user',
        entityId: id,
        ipAddress: req.ip,
      });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

export default new UserController();
