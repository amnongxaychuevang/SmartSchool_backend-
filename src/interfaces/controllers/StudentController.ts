import GetStudentsUseCase from '../../application/use-cases/students/GetStudentsUseCase';
import CreateStudentUseCase from '../../application/use-cases/students/CreateStudentUseCase';
import UpdateStudentUseCase from '../../application/use-cases/students/UpdateStudentUseCase';
import studentRepository from '../../infrastructure/repositories/StudentRepository';
import { bloodTypeOptions } from '../../domain/bloodTypes';
import { savePhoto, removePhoto } from '../../infrastructure/storage/PhotoStorage';

const getStudentsUseCase = new GetStudentsUseCase(studentRepository);
const createStudentUseCase = new CreateStudentUseCase(studentRepository);
const updateStudentUseCase = new UpdateStudentUseCase(studentRepository);

class StudentController {
  async list(req, res, next) {
    try {
      const { search = '', page = 1, limit = 20, status, classId, gender } = req.query;
      const result = await getStudentsUseCase.execute({
        search,
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        classId,
        gender: ['male', 'female', 'other'].includes(gender) ? gender : undefined,
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

  async getBloodTypes(req, res) {
    res.json({ success: true, data: { bloodTypes: bloodTypeOptions() } });
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
      const student = await createStudentUseCase.execute({ ...req.body, issuedBy: req.user?.userId });
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

  async uploadPhoto(req, res, next) {
    let saved: string | null = null;
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'No photo uploaded' });
      const existing = await studentRepository.findById(req.params.id);
      if (!existing) return res.status(404).json({ success: false, message: 'Student not found' });

      saved = await savePhoto(req.file.buffer, 'students');
      const student = await studentRepository.setPhoto(existing.studentId, saved);
      await removePhoto(existing.photoUrl);
      res.json({ success: true, data: { student } });
    } catch (error) {
      await removePhoto(saved); // don't leave an orphan file if the DB update failed
      next(error);
    }
  }

  async deletePhoto(req, res, next) {
    try {
      const existing = await studentRepository.findById(req.params.id);
      if (!existing) return res.status(404).json({ success: false, message: 'Student not found' });
      const student = await studentRepository.setPhoto(existing.studentId, null);
      await removePhoto(existing.photoUrl);
      res.json({ success: true, data: { student } });
    } catch (error) {
      next(error);
    }
  }
}

export default new StudentController();
