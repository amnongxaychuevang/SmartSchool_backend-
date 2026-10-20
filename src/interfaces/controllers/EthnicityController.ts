import ethnicityRepository from '../../infrastructure/repositories/EthnicityRepository';

class EthnicityController {
  async list(req, res, next) {
    try {
      const ethnicities = await ethnicityRepository.findAll();
      res.json({ success: true, data: { ethnicities } });
    } catch (error) {
      next(error);
    }
  }
}

export default new EthnicityController();
