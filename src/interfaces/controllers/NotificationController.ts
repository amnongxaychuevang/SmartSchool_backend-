import notificationRepository from '../../infrastructure/repositories/NotificationRepository';

class NotificationController {
  async list(req, res, next) {
    try {
      const { recipientUserId, studentId, status, page = 1, limit = 30 } = req.query;
      const result = await notificationRepository.findMany({
        recipientUserId,
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
      const {
        recipientUserId, studentId, type, channel,
        messageEn, messageLo,
      } = req.body;

      const notification = await notificationRepository.create({
        recipientUserId: parseInt(recipientUserId),
        ...(studentId ? { studentId: parseInt(studentId) } : {}),
        type,
        channel,
        messageEn,
        messageLo,
      });

      res.status(201).json({ success: true, data: { notification } });
    } catch (error) {
      next(error);
    }
  }

  async markDelivered(req, res, next) {
    try {
      const { id } = req.params;
      const notification = await notificationRepository.markDelivered(id);
      res.json({ success: true, data: { notification } });
    } catch (error) {
      next(error);
    }
  }
}

export default new NotificationController();
