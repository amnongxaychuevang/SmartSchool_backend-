import CreateSubjectUseCase from '../../application/use-cases/subjects/CreateSubjectUseCase';
import UpdateSubjectUseCase from '../../application/use-cases/subjects/UpdateSubjectUseCase';
import DeleteSubjectUseCase from '../../application/use-cases/subjects/DeleteSubjectUseCase';
import subjectRepository from '../../infrastructure/repositories/SubjectRepository';

const createSubjectUseCase = new CreateSubjectUseCase(subjectRepository);
const updateSubjectUseCase = new UpdateSubjectUseCase(subjectRepository);
const deleteSubjectUseCase = new DeleteSubjectUseCase(subjectRepository);

class SubjectController {
  async list(req, res, next) {
    try {
      const { search = '', classId, teacherId, page = 1, limit = 20 } = req.query;
      const result = await subjectRepository.findMany({
        search,
        classId,
        teacherId,
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
      const subject = await createSubjectUseCase.execute(req.body);
      res.status(201).json({ success: true, data: { subject } });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const subject = await updateSubjectUseCase.execute(id, req.body);
      res.json({ success: true, data: { subject } });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      await deleteSubjectUseCase.execute(id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

export default new SubjectController();
