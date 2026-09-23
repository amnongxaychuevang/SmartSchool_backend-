import { PrismaClient  } from '@prisma/client';
const prisma = new PrismaClient();

class GenderController {
  async list(req, res, next) {
    try {
      const genders = await prisma.gender.findMany({
        orderBy: { id: 'asc' },
      });
      res.json({ success: true, data: { genders } });
    } catch (error) {
      next(error);
    }
  }
}

export default new GenderController();
