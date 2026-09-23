import CreateGradeUseCase from '../../application/use-cases/grades/CreateGradeUseCase';
import UpdateGradeUseCase from '../../application/use-cases/grades/UpdateGradeUseCase';
import DeleteGradeUseCase from '../../application/use-cases/grades/DeleteGradeUseCase';
import gradeRepository from '../../infrastructure/repositories/GradeRepository';

const createGradeUseCase = new CreateGradeUseCase(gradeRepository);
const updateGradeUseCase = new UpdateGradeUseCase(gradeRepository);
const deleteGradeUseCase = new DeleteGradeUseCase(gradeRepository);

class GradeController {
  async list(req, res, next) {
    try {
      const { studentId, subjectId, classId, gradeMonth, page = 1, limit = 30 } = req.query;
      const result = await gradeRepository.findMany({
        studentId, subjectId, classId, gradeMonth,
        page: parseInt(page),
        limit: parseInt(limit),
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async listGradeTypes(req, res, next) {
    try {
      const gradeTypes = await gradeRepository.findGradeTypes();
      res.json({ success: true, data: { gradeTypes } });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const grade = await createGradeUseCase.execute(req.body, req.user?.userId);
      res.status(201).json({ success: true, data: { grade } });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const grade = await updateGradeUseCase.execute(id, req.body);
      res.json({ success: true, data: { grade } });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      await deleteGradeUseCase.execute(id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

export default new GradeController();
