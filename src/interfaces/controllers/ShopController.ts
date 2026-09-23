import shopRepository from '../../infrastructure/repositories/ShopRepository';

class ShopController {
  async list(req, res, next) {
    try {
      const { search = '', page = 1, limit = 20 } = req.query;
      const result = await shopRepository.findMany({
        search,
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
      const { shopNameEn, shopNameLo, locationEn, locationLo, descriptionEn, descriptionLo, isActive } = req.body;

      const shop = await shopRepository.create({
        shopNameEn,
        shopNameLo,
        ...(locationEn ? { locationEn } : {}),
        ...(locationLo ? { locationLo } : {}),
        ...(descriptionEn ? { descriptionEn } : {}),
        ...(descriptionLo ? { descriptionLo } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      });

      res.status(201).json({ success: true, data: { shop } });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const { shopNameEn, shopNameLo, locationEn, locationLo, descriptionEn, descriptionLo, isActive } = req.body;

      const data: any = {};
      if (shopNameEn !== undefined) data.shopNameEn = shopNameEn;
      if (shopNameLo !== undefined) data.shopNameLo = shopNameLo;
      if (locationEn !== undefined) data.locationEn = locationEn;
      if (locationLo !== undefined) data.locationLo = locationLo;
      if (descriptionEn !== undefined) data.descriptionEn = descriptionEn;
      if (descriptionLo !== undefined) data.descriptionLo = descriptionLo;
      if (isActive !== undefined) data.isActive = isActive;

      const shop = await shopRepository.update(id, data);
      res.json({ success: true, data: { shop } });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      await shopRepository.delete(id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

export default new ShopController();
