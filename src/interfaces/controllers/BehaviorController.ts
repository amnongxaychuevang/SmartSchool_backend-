import behaviorRepository from '../../infrastructure/repositories/BehaviorRepository';

class BehaviorController {
  async listRecords(req: any, res: any, next: any) {
    try {
      const { studentId, classId, type, search, page, limit } = req.query;
      const result = await behaviorRepository.listRecords({
        studentId: studentId ? Number(studentId) : undefined,
        classId: classId ? Number(classId) : undefined,
        type,
        search,
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
      const { studentId } = req.params;
      const result = await behaviorRepository.getStudentConduct(Number(studentId));
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async createRecord(req: any, res: any, next: any) {
    try {
      const record = await behaviorRepository.createRecord(req.body, req.user?.userId);
      res.status(201).json({ success: true, data: { record } });
    } catch (error) {
      next(error);
    }
  }

  async deleteRecord(req: any, res: any, next: any) {
    try {
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
