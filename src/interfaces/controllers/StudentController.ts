import GetStudentsUseCase from '../../application/use-cases/students/GetStudentsUseCase';
import CreateStudentUseCase from '../../application/use-cases/students/CreateStudentUseCase';
import UpdateStudentUseCase from '../../application/use-cases/students/UpdateStudentUseCase';
import studentRepository from '../../infrastructure/repositories/StudentRepository';

const getStudentsUseCase = new GetStudentsUseCase(studentRepository);
const createStudentUseCase = new CreateStudentUseCase(studentRepository);
const updateStudentUseCase = new UpdateStudentUseCase(studentRepository);

class StudentController {
  async list(req, res, next) {
    try {
      const { search = '', page = 1, limit = 20, status, classId } = req.query;
      const result = await getStudentsUseCase.execute({
        search,
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        classId,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getStatuses(req, res, next) {
    try {
      const statuses = [
        { code: 'active', labelKey: 'common.active' },
        { code: 'inactive', labelKey: 'common.inactive' },
        { code: 'graduated', labelKey: 'students.graduated' },
        { code: 'transferred', labelKey: 'students.transferred' }
      ];
      res.json({ success: true, data: { statuses } });
    } catch (error) {
      next(error);
    }
  }

  async get(req, res, next) {
    try {
      const student = await studentRepository.findById(req.params.id);
      if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
      res.json({ success: true, data: { student } });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const student = await createStudentUseCase.execute(req.body);
      res.json({ success: true, data: { student } });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const student = await updateStudentUseCase.execute(id, req.body);
      res.json({ success: true, data: { student } });
    } catch (error) {
      next(error);
    }
  }
}

export default new StudentController();
