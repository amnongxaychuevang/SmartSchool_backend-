import CreateTeacherUseCase from '../../application/use-cases/teachers/CreateTeacherUseCase';
import UpdateTeacherUseCase from '../../application/use-cases/teachers/UpdateTeacherUseCase';
import teacherRepository from '../../infrastructure/repositories/TeacherRepository';

const createTeacherUseCase = new CreateTeacherUseCase(teacherRepository);
const updateTeacherUseCase = new UpdateTeacherUseCase(teacherRepository);

class TeacherController {
  async list(req, res, next) {
    try {
      const { search = '', page = 1, limit = 20 } = req.query;
      const result = await teacherRepository.findMany({
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
      const teacher = await createTeacherUseCase.execute(req.body);
      res.status(201).json({ success: true, data: { teacher } });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const teacher = await updateTeacherUseCase.execute(id, req.body);
      res.json({ success: true, data: { teacher } });
    } catch (error) {
      next(error);
    }
  }

}

export default new TeacherController();
