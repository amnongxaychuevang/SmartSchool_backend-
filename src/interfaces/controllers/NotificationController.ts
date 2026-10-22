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
        titleEn: req.body.titleEn,
        titleLo: req.body.titleLo,
        link: req.body.link,
      });

      // Real-time in-app notification push
      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        socketManager.toUser(parseInt(recipientUserId), 'new-notification', notification);
      }

      res.status(201).json({ success: true, data: { notification } });
    } catch (error) {
      next(error);
    }
  }

  async markDelivered(req: any, res: any, next: any) {
    try {
      const { id } = req.params;
      const notification = await notificationRepository.markDelivered(id);
      res.json({ success: true, data: { notification } });
    } catch (error) {
      next(error);
    }
  }

  async getMyNotifications(req: any, res: any, next: any) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const { unreadOnly, page = 1, limit = 20 } = req.query;
      const result = await notificationRepository.findUserNotifications(userId, {
        unreadOnly: unreadOnly === 'true',
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req: any, res: any, next: any) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const unreadCount = await notificationRepository.getUnreadCount(userId);
      res.json({ success: true, data: { unreadCount } });
    } catch (error) {
      next(error);
    }
  }

  async markRead(req: any, res: any, next: any) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;
      await notificationRepository.markAsRead(parseInt(id), userId);
      res.json({ success: true, message: 'Marked as read' });
    } catch (error) {
      next(error);
    }
  }

  async markAllRead(req: any, res: any, next: any) {
    try {
      const userId = req.user?.userId;
      await notificationRepository.markAllAsRead(userId);
      res.json({ success: true, message: 'All marked as read' });
    } catch (error) {
      next(error);
    }
  }
}

export default new NotificationController();
