import GetClassesUseCase from '../../application/use-cases/classes/GetClassesUseCase';
import CreateClassUseCase from '../../application/use-cases/classes/CreateClassUseCase';
import UpdateClassUseCase from '../../application/use-cases/classes/UpdateClassUseCase';
import DeleteClassUseCase from '../../application/use-cases/classes/DeleteClassUseCase';
import classRepository from '../../infrastructure/repositories/ClassRepository';

const getClassesUseCase = new GetClassesUseCase(classRepository);
const createClassUseCase = new CreateClassUseCase(classRepository);
const updateClassUseCase = new UpdateClassUseCase(classRepository);
const deleteClassUseCase = new DeleteClassUseCase(classRepository);

class ClassController {
  async list(req, res, next) {
    try {
      const { search = '', page = 1, limit = 20, academicYear, status } = req.query;
      const result = await getClassesUseCase.execute({
        search,
        page: parseInt(page),
        limit: parseInt(limit),
        teacherUserId: req.user?.role === 'teacher' ? req.user.userId : undefined,
        academicYear: /^\d{4}-\d{4}$/.test(academicYear) ? academicYear : undefined,
        status,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async listAll(req, res, next) {
    try {
      const teacherUserId = req.user?.role === 'teacher' ? req.user.userId : undefined;
      const result = await classRepository.findAll(teacherUserId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async get(req, res, next) {
    try {
      const schoolClass = await classRepository.findById(req.params.id);
      if (!schoolClass) return res.status(404).json({ success: false, message: 'Class not found' });
      res.json({ success: true, data: { class: schoolClass } });
    } catch (error) {
      next(error);
    }
  }

  async academicYears(req, res, next) {
    try {
      res.json({ success: true, data: { academicYears: await classRepository.findAcademicYears() } });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const schoolClass = await createClassUseCase.execute(req.body);
      res.status(201).json({ success: true, data: { class: schoolClass } });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const schoolClass = await updateClassUseCase.execute(id, req.body);
      res.json({ success: true, data: { class: schoolClass } });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      await deleteClassUseCase.execute(id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

export default new ClassController();
