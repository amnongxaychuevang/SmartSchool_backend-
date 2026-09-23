import academicTermRepository from '../../infrastructure/repositories/AcademicTermRepository';

class AcademicTermController {
  async list(req, res, next) {
    try {
      const terms = await academicTermRepository.findMany();
      res.json({ success: true, data: { terms } });
    } catch (error) {
      next(error);
    }
  }

  async get(req, res, next) {
    try {
      const term = await academicTermRepository.findById(req.params.id);
      if (!term) return res.status(404).json({ success: false, message: 'Term not found' });
      res.json({ success: true, data: { term } });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const term = await academicTermRepository.create(req.body);
      res.status(201).json({ success: true, data: { term } });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const term = await academicTermRepository.update(req.params.id, req.body);
      res.json({ success: true, data: { term } });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await academicTermRepository.delete(req.params.id);
      res.json({ success: true, message: 'Term deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export default new AcademicTermController();
