import provinceRepository from '../../infrastructure/repositories/ProvinceRepository';

class ProvinceController {
  async list(req, res, next) {
    try {
      const provinces = await provinceRepository.findAllWithDistricts();
      res.json({ success: true, data: { provinces } });
    } catch (error) {
      next(error);
    }
  }
}

export default new ProvinceController();
