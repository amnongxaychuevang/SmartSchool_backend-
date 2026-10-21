import schoolRepository from '../../infrastructure/repositories/SchoolRepository';

class SchoolController {
  async listSchools(req: any, res: any, next: any) {
    try {
      const schools = await schoolRepository.listSchools();
      res.json({ success: true, data: { schools } });
    } catch (error) {
      next(error);
    }
  }

  async getSchool(req: any, res: any, next: any) {
    try {
      const { id } = req.params;
      const school = await schoolRepository.getSchool(Number(id));
      if (!school) {
        return res.status(404).json({ success: false, message: 'School not found' });
      }
      res.json({ success: true, data: { school } });
    } catch (error) {
      next(error);
    }
  }

  async createSchool(req: any, res: any, next: any) {
    try {
      const school = await schoolRepository.createSchool(req.body);
      res.status(201).json({ success: true, data: { school } });
    } catch (error) {
      next(error);
    }
  }

  async updateSchool(req: any, res: any, next: any) {
    try {
      const { id } = req.params;
      const school = await schoolRepository.updateSchool(Number(id), req.body);
      res.json({ success: true, data: { school } });
    } catch (error) {
      next(error);
    }
  }

  async deleteSchool(req: any, res: any, next: any) {
    try {
      const { id } = req.params;
      await schoolRepository.deleteSchool(Number(id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  async getOverview(req: any, res: any, next: any) {
    try {
      const overview = await schoolRepository.getOverview();
      res.json({ success: true, data: overview });
    } catch (error) {
      next(error);
    }
  }
}

export default new SchoolController();
