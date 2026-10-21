import riskAnalyticsRepository from '../../infrastructure/repositories/RiskAnalyticsRepository';

class RiskAnalyticsController {
  async runAssessment(req: any, res: any, next: any) {
    try {
      const { classId } = req.body;
      const results = await riskAnalyticsRepository.runAssessment({
        classId: classId ? Number(classId) : undefined,
      });
      res.json({ success: true, data: { count: results.length, results } });
    } catch (error) {
      next(error);
    }
  }

  async listAtRisk(req: any, res: any, next: any) {
    try {
      const { classId, riskLevel, page, limit } = req.query;
      const result = await riskAnalyticsRepository.listAtRiskStudents({
        classId: classId ? Number(classId) : undefined,
        riskLevel,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getStudentRiskDetail(req: any, res: any, next: any) {
    try {
      const { studentId } = req.params;
      const detail = await riskAnalyticsRepository.getStudentRiskDetail(Number(studentId));
      res.json({ success: true, data: detail });
    } catch (error) {
      next(error);
    }
  }

  async createIntervention(req: any, res: any, next: any) {
    try {
      const intervention = await riskAnalyticsRepository.createIntervention(
        req.body,
        req.user?.userId
      );
      res.status(201).json({ success: true, data: { intervention } });
    } catch (error) {
      next(error);
    }
  }

  async updateIntervention(req: any, res: any, next: any) {
    try {
      const { id } = req.params;
      const intervention = await riskAnalyticsRepository.updateIntervention(
        Number(id),
        req.body
      );
      res.json({ success: true, data: { intervention } });
    } catch (error) {
      next(error);
    }
  }

  async getOverview(req: any, res: any, next: any) {
    try {
      const overview = await riskAnalyticsRepository.getOverview();
      res.json({ success: true, data: overview });
    } catch (error) {
      next(error);
    }
  }
}

export default new RiskAnalyticsController();
