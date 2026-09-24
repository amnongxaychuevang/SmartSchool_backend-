import classSubjectRepository from '../../infrastructure/repositories/ClassSubjectRepository';

class ClassSubjectController {
  // GET /class-subjects?classId=&subjectId=&teacherId=&termId=
  // Teachers only see what they teach.
  async list(req, res, next) {
    try {
      const { classId, subjectId, termId } = req.query;
      let { teacherId } = req.query;
      if (req.user?.role === 'teacher') teacherId = req.user.userId;
      const classSubjects = await classSubjectRepository.findMany({ classId, subjectId, teacherId, termId });
      res.json({ success: true, data: { classSubjects } });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const classSubject = await classSubjectRepository.create(req.body);
      res.status(201).json({ success: true, data: { classSubject } });
    } catch (error) {
      next(error);
    }
  }

  // PUT /class-subjects/:id  { teacherId }
  async update(req, res, next) {
    try {
      const classSubject = await classSubjectRepository.setTeacher(Number(req.params.id), req.body.teacherId ?? null);
      res.json({ success: true, data: { classSubject } });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await classSubjectRepository.delete(Number(req.params.id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

export default new ClassSubjectController();
