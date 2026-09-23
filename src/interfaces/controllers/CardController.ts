import CreateCardUseCase from '../../application/use-cases/cards/CreateCardUseCase';
import UpdateCardUseCase from '../../application/use-cases/cards/UpdateCardUseCase';
import DeleteCardUseCase from '../../application/use-cases/cards/DeleteCardUseCase';
import cardRepository from '../../infrastructure/repositories/CardRepository';

const createCardUseCase = new CreateCardUseCase(cardRepository);
const updateCardUseCase = new UpdateCardUseCase(cardRepository);
const deleteCardUseCase = new DeleteCardUseCase(cardRepository);

class CardController {
  async list(req, res, next) {
    try {
      const { studentId, status, page = 1, limit = 20 } = req.query;
      const result = await cardRepository.findMany({
        studentId,
        status,
        page: parseInt(page),
        limit: parseInt(limit),
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const card = await createCardUseCase.execute(req.body, req.user?.userId);
      res.status(201).json({ success: true, data: { card } });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const card = await updateCardUseCase.execute(id, req.body);
      res.json({ success: true, data: { card } });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      await deleteCardUseCase.execute(id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

export default new CardController();
