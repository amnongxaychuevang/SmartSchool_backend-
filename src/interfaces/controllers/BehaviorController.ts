import behaviorRepository from '../../infrastructure/repositories/BehaviorRepository';


// Teachers work only with students in their own classes, and change only the records they wrote.
const notYourStudent = () => Object.assign(new Error('This student is not in your class'), { statusCode: 403 });
async function assertOwnRecord(req: any) {
  if (req.user?.role !== 'teacher') return;
  const record = await behaviorRepository.findRecord(Number(req.params.id));
  if (!record) throw Object.assign(new Error('Record not found'), { statusCode: 404 });
  if (record.recordedBy !== req.user.userId) throw Object.assign(new Error('You can only change records you wrote'), { statusCode: 403 });
}

class BehaviorController {
  async listRecords(req: any, res: any, next: any) {
    try {
      const { studentId, classId, type, search, page, limit } = req.query;
      const result = await behaviorRepository.listRecords({
        studentId: studentId ? Number(studentId) : undefined,
        classId: classId ? Number(classId) : undefined,
        type,
        search,
        teacherUserId: req.user?.role === 'teacher' ? req.user.userId : undefined,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getStudentConduct(req: any, res: any, next: any) {
    try {
      if (req.user?.role === 'teacher' && !(await behaviorRepository.teacherHasStudent(req.user.userId, Number(req.params.studentId)))) {
        throw notYourStudent();
      }
      const { studentId } = req.params;
      const result = await behaviorRepository.getStudentConduct(Number(studentId));
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async createRecord(req: any, res: any, next: any) {
    try {
      if (req.user?.role === 'teacher' && !(await behaviorRepository.teacherHasStudent(req.user.userId, Number(req.body.studentId)))) {
        throw notYourStudent();
      }
      const record = await behaviorRepository.createRecord(req.body, req.user?.userId);
      res.status(201).json({ success: true, data: { record } });
    } catch (error) {
      next(error);
    }
  }

  async updateRecord(req: any, res: any, next: any) {
    try {
      await assertOwnRecord(req);
      const record = await behaviorRepository.updateRecord(Number(req.params.id), req.body);
      res.json({ success: true, data: { record } });
    } catch (error) {
      next(error);
    }
  }

  async updateCategory(req: any, res: any, next: any) {
    try {
      const category = await behaviorRepository.updateCategory(Number(req.params.id), req.body);
      res.json({ success: true, data: { category } });
    } catch (error) {
      next(error);
    }
  }

  async deleteCategory(req: any, res: any, next: any) {
    try {
      await behaviorRepository.deleteCategory(Number(req.params.id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async deleteRecord(req: any, res: any, next: any) {
    try {
      await assertOwnRecord(req);
      const { id } = req.params;
      await behaviorRepository.deleteRecord(Number(id));
      res.json({ success: true, message: 'Record deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async listCategories(req: any, res: any, next: any) {
    try {
      const categories = await behaviorRepository.listCategories();
      res.json({ success: true, data: { categories } });
    } catch (error) {
      next(error);
    }
  }

  async createCategory(req: any, res: any, next: any) {
    try {
      const category = await behaviorRepository.createCategory(req.body);
      res.status(201).json({ success: true, data: { category } });
    } catch (error) {
      next(error);
    }
  }

  async getOverview(req: any, res: any, next: any) {
    try {
      const overview = await behaviorRepository.getOverview();
      res.json({ success: true, data: overview });
    } catch (error) {
      next(error);
    }
  }
}

export default new BehaviorController();
