import announcementRepository from '../../infrastructure/repositories/AnnouncementRepository';

class AnnouncementController {
  async list(req, res, next) {
    try {
      const announcements = await announcementRepository.findAll();
      res.json({ success: true, data: announcements });
    } catch (error) {
      next(error);
    }
  }

  async get(req, res, next) {
    try {
      const announcement = await announcementRepository.findById(req.params.id);
      if (!announcement) {
        return res.status(404).json({ success: false, message: 'Announcement not found' });
      }
      res.json({ success: true, data: announcement });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const { titleEn, titleLo, contentEn, contentLo, targetAudience, expiryDate } = req.body;
      const createdBy = req.user.userId; // Provided by AuthMiddleware

      const newAnnouncement = await announcementRepository.create({
        titleEn,
        titleLo,
        contentEn,
        contentLo,
        targetAudience: targetAudience || 'all',
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        createdBy
      });

      res.status(201).json({ success: true, data: newAnnouncement });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { titleEn, titleLo, contentEn, contentLo, targetAudience, expiryDate } = req.body;
      const data: any = {};
      if (titleEn !== undefined) data.titleEn = titleEn;
      if (titleLo !== undefined) data.titleLo = titleLo;
      if (contentEn !== undefined) data.contentEn = contentEn;
      if (contentLo !== undefined) data.contentLo = contentLo;
      if (targetAudience !== undefined) data.targetAudience = targetAudience;
      if (expiryDate !== undefined) data.expiryDate = expiryDate ? new Date(expiryDate) : null;

      const updated = await announcementRepository.update(req.params.id, data);
      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      await announcementRepository.delete(req.params.id);
      res.json({ success: true, message: 'Announcement deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export default new AnnouncementController();
