import summerRepository from '../../infrastructure/repositories/SummerRepository';

class SummerController {
  // ─── Courses ───────────────────────────────────────────────
  async listCourses(req: any, res: any, next: any) {
    try {
      const { academicYear, includeInactive } = req.query;
      const courses = await summerRepository.listCourses(
        academicYear ? String(academicYear) : undefined,
        includeInactive === 'true'
      );
      res.json({ success: true, data: { courses } });
    } catch (error) {
      next(error);
    }
  }

  async createCourse(req: any, res: any, next: any) {
    try {
      const course = await summerRepository.createCourse(req.body);
      res.status(201).json({ success: true, data: { course }, message: 'Summer course created successfully' });
    } catch (error) {
      next(error);
    }
  }

  async updateCourse(req: any, res: any, next: any) {
    try {
      const courseId = parseInt(req.params.id, 10);
      const course = await summerRepository.updateCourse(courseId, req.body);
      res.json({ success: true, data: { course }, message: 'Summer course updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  async deleteCourse(req: any, res: any, next: any) {
    try {
      const courseId = parseInt(req.params.id, 10);
      await summerRepository.deleteCourse(courseId);
      res.json({ success: true, message: 'Summer course deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // ─── Registrations ─────────────────────────────────────────
  async register(req: any, res: any, next: any) {
    try {
      const recordedBy = req.user?.userId;
      const registration = await summerRepository.registerStudent({
        ...req.body,
        recordedBy,
      });

      res.status(201).json({
        success: true,
        data: { registration },
        message: 'Student registered for Summer classes successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async listRegistrations(req: any, res: any, next: any) {
    try {
      const { academicYear, month, search, paymentStatus, page, limit } = req.query;
      const result = await summerRepository.listRegistrations({
        academicYear: academicYear ? String(academicYear) : undefined,
        month: month ? parseInt(String(month), 10) : undefined,
        search: search ? String(search) : undefined,
        paymentStatus: paymentStatus ? String(paymentStatus) : undefined,
        page: page ? parseInt(String(page), 10) : 1,
        limit: limit ? parseInt(String(limit), 10) : 20,
      });

      res.json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  }

  async getRegistration(req: any, res: any, next: any) {
    try {
      const id = parseInt(req.params.id, 10);
      const registration = await summerRepository.getRegistrationById(id);
      if (!registration) {
        return res.status(404).json({ success: false, message: 'Registration not found' });
      }
      res.json({ success: true, data: { registration } });
    } catch (error) {
      next(error);
    }
  }

  async getStats(req: any, res: any, next: any) {
    try {
      const { academicYear } = req.query;
      const stats = await summerRepository.getStats(academicYear ? String(academicYear) : undefined);
      res.json({ success: true, data: { stats } });
    } catch (error) {
      next(error);
    }
  }
}

export default new SummerController();
