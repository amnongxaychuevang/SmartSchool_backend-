import assignmentRepository from '../../infrastructure/repositories/AssignmentRepository';
import { teacherHasClass } from '../../infrastructure/repositories/AcademicYear';
import { saveAssignmentFile } from '../../infrastructure/storage/PhotoStorage';

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

  async listSubmissions(req, res, next) {
    try {
      const assignmentId = Number(req.params.id);
      const existing = await assignmentRepository.findById(assignmentId);
      if (!existing) throw Object.assign(new Error('Assignment not found'), { statusCode: 404 });
      if (req.user.role === 'teacher' && !(await teacherHasClass(req.user.userId, existing.classId))) throw forbidClass();
      const result = await assignmentRepository.listSubmissions(assignmentId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async submit(req, res, next) {
    try {
      const assignmentId = Number(req.params.id);
      const studentId = Number(req.body.studentId);
      if (!studentId) throw Object.assign(new Error('Student ID is required'), { statusCode: 400 });

      let fileUrl = req.body.fileUrl;
      let fileName = req.body.fileName;
      let fileSize = req.body.fileSize ? Number(req.body.fileSize) : undefined;

      if (req.file) {
        const saved = await saveAssignmentFile(req.file.buffer, req.file.originalname);
        fileUrl = saved.url;
        fileName = saved.fileName;
        fileSize = saved.fileSize;
      }

      if (!fileUrl) throw Object.assign(new Error('Please upload an assignment file'), { statusCode: 400 });

      const submission = await assignmentRepository.submit({
        assignmentId,
        studentId,
        fileUrl,
        fileName,
        fileSize,
      });

      res.status(201).json({ success: true, data: { submission } });
    } catch (error) {
      next(error);
    }
  }

  async grade(req, res, next) {
    try {
      const submissionId = Number(req.params.submissionId);
      const score = Number(req.body.score);
      const maxScore = req.body.maxScore !== undefined ? Number(req.body.maxScore) : undefined;
      const feedback = req.body.feedback;

      if (isNaN(score) || score < 0) {
        throw Object.assign(new Error('Please provide a valid score'), { statusCode: 400 });
      }

      const submission = await assignmentRepository.gradeSubmission(
        submissionId,
        { score, maxScore, feedback },
        req.user.userId
      );

      res.json({ success: true, data: { submission } });
    } catch (error) {
      next(error);
    }
  }

  async listForStudent(req, res, next) {
    try {
      const studentId = Number(req.params.studentId);
      const assignments = await assignmentRepository.listForStudent(studentId);
      res.json({ success: true, data: { assignments } });
    } catch (error) {
      next(error);
    }
  }
}

export default new AssignmentController();
