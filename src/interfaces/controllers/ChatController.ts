import chatRepository from '../../infrastructure/repositories/ChatRepository';
import notificationRepository from '../../infrastructure/repositories/NotificationRepository';

class ChatController {
  async listConversations(req: any, res: any, next: any) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const conversations = await chatRepository.listConversations(userId);
      res.json({ success: true, data: { conversations } });
    } catch (error) {
      next(error);
    }
  }

  async getOrCreate(req: any, res: any, next: any) {
    try {
      const currentUserId = req.user?.userId;
      const { targetUserId, studentId } = req.body;

      if (!currentUserId || !targetUserId) {
        return res.status(400).json({ success: false, message: 'targetUserId is required' });
      }

      const userRole = req.user?.role?.toLowerCase() || '';
      const isTeacher = userRole.includes('teacher');

      const teacherId = isTeacher ? currentUserId : Number(targetUserId);
      const parentId = isTeacher ? Number(targetUserId) : currentUserId;

      const conversation = await chatRepository.getOrCreateConversation(
        teacherId,
        parentId,
        studentId ? Number(studentId) : undefined
      );

      res.status(201).json({ success: true, data: { conversation } });
    } catch (error) {
      next(error);
    }
  }

  async getMessages(req: any, res: any, next: any) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 50 } = req.query;

      const result = await chatRepository.getMessages(
        Number(id),
        Number(page),
        Number(limit)
      );

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async sendMessage(req: any, res: any, next: any) {
    try {
      const senderId = req.user?.userId;
      const { id } = req.params;
      const { content, attachmentUrl } = req.body;

      if (!senderId || !content?.trim()) {
        return res.status(400).json({ success: false, message: 'Content is required' });
      }

      const message = await chatRepository.sendMessage({
        conversationId: Number(id),
        senderId,
        content: content.trim(),
        attachmentUrl,
      });

      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        // Broadcast to chat room
        socketManager.toRoom(`chat:${id}`, 'chat:new-message', message);
      }

      // Find recipient to notify
      const conv = await chatRepository.listConversations(senderId);
      const targetConv = conv.find((c) => c.conversationId === Number(id));
      if (targetConv) {
        const recipientUserId = targetConv.teacherId === senderId ? targetConv.parentId : targetConv.teacherId;
        const senderName = req.user?.fullNameEn || 'New Message';

        // 1. Socket notification
        if (socketManager) {
          socketManager.toUser(recipientUserId, 'chat:notification', {
            conversationId: Number(id),
            message,
            senderName,
          });
        }

        // 2. In-App Notification record
        await notificationRepository.create({
          recipientUserId,
          type: 'general',
          channel: 'app_push',
          titleEn: `New message from ${senderName}`,
          titleLo: `ຂໍ້ຄວາມໃໝ່ຈາກ ${req.user?.fullNameLo || senderName}`,
          messageEn: content.length > 80 ? content.slice(0, 80) + '...' : content,
          messageLo: content.length > 80 ? content.slice(0, 80) + '...' : content,
          link: req.user?.role?.toLowerCase()?.includes('teacher') ? '/parent/chat' : '/teacher/chat',
        }).catch(() => {});
      }

      res.status(201).json({ success: true, data: { message } });
    } catch (error) {
      next(error);
    }
  }

  async markRead(req: any, res: any, next: any) {
    try {
      const userId = req.user?.userId;
      const { id } = req.params;

      await chatRepository.markAsRead(Number(id), userId);

      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        socketManager.toRoom(`chat:${id}`, 'chat:messages-read', {
          conversationId: Number(id),
          readBy: userId,
        });
      }

      res.json({ success: true, message: 'Marked read' });
    } catch (error) {
      next(error);
    }
  }

  async getContacts(req: any, res: any, next: any) {
    try {
      const userId = req.user?.userId;
      const roleName = req.user?.role || 'parent';

      const contacts = await chatRepository.getAvailableContacts(userId, roleName);
      res.json({ success: true, data: { contacts } });
    } catch (error) {
      next(error);
    }
  }
}

export default new ChatController();
