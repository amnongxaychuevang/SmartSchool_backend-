import assignmentRepository from '../../infrastructure/repositories/AssignmentRepository';
import { teacherHasClass } from '../../infrastructure/repositories/AcademicYear';

// Teachers see and change homework only for classes they teach or are homeroom teacher of.
const forbidClass = () => Object.assign(new Error('You do not teach this class'), { statusCode: 403 });

class AssignmentController {
  async list(req, res, next) {
    try {
      const when = req.query.when === 'past' || req.query.when === 'upcoming' ? req.query.when : undefined;
      const result = await assignmentRepository.list({
        classId: req.query.classId ? Number(req.query.classId) : undefined,
        teacherUserId: req.user.role === 'teacher' ? req.user.userId : undefined,
        when,
        page: Math.max(1, parseInt(req.query.page) || 1),
        limit: Math.min(100, Math.max(1, parseInt(req.query.limit) || 15)),
      });
      res.json({ success: true, data: result.data, meta: result.meta });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      if (req.user.role === 'teacher' && !(await teacherHasClass(req.user.userId, req.body.classId))) throw forbidClass();
      const assignment = await assignmentRepository.create(req.body, req.user.userId);
      res.status(201).json({ success: true, data: { assignment } });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const id = Number(req.params.id);
      const existing = await assignmentRepository.findById(id);
      if (!existing) throw Object.assign(new Error('Assignment not found'), { statusCode: 404 });
      if (req.user.role === 'teacher') {
        if (!(await teacherHasClass(req.user.userId, existing.classId))) throw forbidClass();
        if (req.body.classId && !(await teacherHasClass(req.user.userId, req.body.classId))) throw forbidClass();
      }
      const assignment = await assignmentRepository.update(id, req.body);
      res.json({ success: true, data: { assignment } });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const id = Number(req.params.id);
      const existing = await assignmentRepository.findById(id);
      if (!existing) throw Object.assign(new Error('Assignment not found'), { statusCode: 404 });
      if (req.user.role === 'teacher' && !(await teacherHasClass(req.user.userId, existing.classId))) throw forbidClass();
      await assignmentRepository.delete(id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

export default new AssignmentController();
