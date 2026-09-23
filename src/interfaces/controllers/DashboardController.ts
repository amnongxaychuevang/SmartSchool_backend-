import GetDashboardStatsUseCase from '../../application/use-cases/dashboard/GetDashboardStatsUseCase';

const getDashboardStatsUseCase = new GetDashboardStatsUseCase();

class DashboardController {
  async stats(req, res, next) {
    try {
      const data = await getDashboardStatsUseCase.execute();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}

export default new DashboardController();
