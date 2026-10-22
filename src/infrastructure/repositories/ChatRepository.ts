import prisma from '../database/PrismaClient';

export class ChatRepository {
  /**
   * List all conversations for a user (teacher or parent)
   */
  async listConversations(userId: number) {
    const conversations = await prisma.chatConversation.findMany({
      where: {
        OR: [
          { teacherId: userId },
          { parentId: userId },
        ],
      },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        teacher: {
          select: {
            userId: true,
            fullNameEn: true,
            fullNameLo: true,
            avatarUrl: true,
            role: { select: { roleName: true } },
          },
        },
        parent: {
          select: {
            userId: true,
            fullNameEn: true,
            fullNameLo: true,
            avatarUrl: true,
            role: { select: { roleName: true } },
          },
        },
        student: {
          select: {
            studentId: true,
            studentCode: true,
            fullNameEn: true,
            fullNameLo: true,
            photoUrl: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    // Compute unread counts for each conversation for this user
    const conversationIds = conversations.map((c) => c.conversationId);
    const unreadCounts = await prisma.chatMessage.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: conversationIds },
        senderId: { not: userId },
        isRead: false,
      },
      _count: { messageId: true },
    });

    const unreadMap = new Map<number, number>();
    for (const item of unreadCounts) {
      unreadMap.set(item.conversationId, item._count.messageId);
    }

    return conversations.map((c) => ({
      ...c,
      unreadCount: unreadMap.get(c.conversationId) || 0,
    }));
  }

  /**
   * Find or create conversation between a teacher and parent, optionally regarding a student
   */
  async getOrCreateConversation(teacherId: number, parentId: number, studentId?: number) {
    const existing = await prisma.chatConversation.findFirst({
      where: {
        teacherId,
        parentId,
        studentId: studentId ?? null,
      },
      include: {
        teacher: { select: { userId: true, fullNameEn: true, fullNameLo: true, avatarUrl: true } },
        parent: { select: { userId: true, fullNameEn: true, fullNameLo: true, avatarUrl: true } },
        student: { select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true } },
      },
    });

    if (existing) return existing;

    return prisma.chatConversation.create({
      data: {
        teacherId,
        parentId,
        studentId: studentId ?? null,
      },
      include: {
        teacher: { select: { userId: true, fullNameEn: true, fullNameLo: true, avatarUrl: true } },
        parent: { select: { userId: true, fullNameEn: true, fullNameLo: true, avatarUrl: true } },
        student: { select: { studentId: true, studentCode: true, fullNameEn: true, fullNameLo: true } },
      },
    });
  }

  /**
   * Get messages in a conversation with pagination
   */
  async getMessages(conversationId: number, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
        include: {
          sender: {
            select: {
              userId: true,
              fullNameEn: true,
              fullNameLo: true,
              avatarUrl: true,
            },
          },
        },
      }),
      prisma.chatMessage.count({ where: { conversationId } }),
    ]);

    return { messages, total, page, limit };
  }

  /**
   * Send a new message
   */
  async sendMessage(data: {
    conversationId: number;
    senderId: number;
    content: string;
    attachmentUrl?: string;
  }) {
    const now = new Date();

    const [message] = await Promise.all([
      prisma.chatMessage.create({
        data: {
          conversationId: data.conversationId,
          senderId: data.senderId,
          content: data.content,
          attachmentUrl: data.attachmentUrl ?? null,
          createdAt: now,
        },
        include: {
          sender: {
            select: {
              userId: true,
              fullNameEn: true,
              fullNameLo: true,
              avatarUrl: true,
            },
          },
        },
      }),
      prisma.chatConversation.update({
        where: { conversationId: data.conversationId },
        data: {
          lastMessage: data.content,
          lastMessageAt: now,
        },
      }),
    ]);

    return message;
  }

  /**
   * Mark all messages in a conversation as read (for messages sent by the other party)
   */
  async markAsRead(conversationId: number, userId: number) {
    return prisma.chatMessage.updateMany({
      where: {
        conversationId,
        senderId: { not: userId },
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Get eligible contacts for teacher or parent
   */
  async getAvailableContacts(userId: number, roleName: string) {
    if (roleName === 'Parent' || roleName === 'parent') {
      // Find students linked to this parent
      const parentUser = await prisma.user.findUnique({
        where: { userId },
        include: {
          parent: {
            include: {
              parentStudents: {
                include: {
                  student: {
                    include: {
                      classStudents: {
                        where: { status: 'active' },
                        include: {
                          class: {
                            include: {
                              homeroomTeacher: {
                                select: { userId: true, fullNameEn: true, fullNameLo: true, avatarUrl: true },
                              },
                              classSubjects: {
                                include: {
                                  teacher: {
                                    select: { userId: true, fullNameEn: true, fullNameLo: true, avatarUrl: true },
                                  },
                                  subject: { select: { subjectNameEn: true, subjectNameLo: true } },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const teachersMap = new Map<number, any>();

      parentUser?.parent?.parentStudents.forEach((ps) => {
        const student = ps.student;
        ps.student.classStudents.forEach((cs) => {
          const cls = cs.class;
          // Homeroom teacher
          if (cls.homeroomTeacher) {
            teachersMap.set(cls.homeroomTeacher.userId, {
              userId: cls.homeroomTeacher.userId,
              fullNameEn: cls.homeroomTeacher.fullNameEn,
              fullNameLo: cls.homeroomTeacher.fullNameLo,
              avatarUrl: cls.homeroomTeacher.avatarUrl,
              role: 'Homeroom Teacher',
              studentId: student.studentId,
              studentName: student.fullNameEn,
            });
          }
          // Subject teachers
          cls.classSubjects.forEach((sub) => {
            if (sub.teacher && !teachersMap.has(sub.teacher.userId)) {
              teachersMap.set(sub.teacher.userId, {
                userId: sub.teacher.userId,
                fullNameEn: sub.teacher.fullNameEn,
                fullNameLo: sub.teacher.fullNameLo,
                avatarUrl: sub.teacher.avatarUrl,
                role: sub.subject ? `Subject: ${sub.subject.subjectNameEn}` : 'Teacher',
                studentId: student.studentId,
                studentName: student.fullNameEn,
              });
            }
          });
        });
      });

      // If no homeroom/subject teacher found, fallback to any teacher users
      if (teachersMap.size === 0) {
        const anyTeachers = await prisma.user.findMany({
          where: { role: { roleName: { in: ['Teacher', 'teacher'] } }, userId: { not: userId } },
          select: { userId: true, fullNameEn: true, fullNameLo: true, avatarUrl: true },
          take: 10,
        });
        for (const t of anyTeachers) {
          teachersMap.set(t.userId, {
            userId: t.userId,
            fullNameEn: t.fullNameEn,
            fullNameLo: t.fullNameLo,
            avatarUrl: t.avatarUrl,
            role: 'Teacher',
          });
        }
      }

      return Array.from(teachersMap.values());
    } else {
      // Teacher: Find parents of all students in classes they teach
      const teacherUser = await prisma.user.findUnique({
        where: { userId },
        include: {
          classes: {
            include: {
              classStudents: {
                where: { status: 'active' },
                include: {
                  student: {
                    include: {
                      parentStudents: {
                        include: {
                          parent: {
                            include: {
                              user: {
                                select: { userId: true, fullNameEn: true, fullNameLo: true, avatarUrl: true, phoneNumber: true },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          taughtClassSubjects: {
            include: {
              class: {
                include: {
                  classStudents: {
                    where: { status: 'active' },
                    include: {
                      student: {
                        include: {
                          parentStudents: {
                            include: {
                              parent: {
                                include: {
                                  user: {
                                    select: { userId: true, fullNameEn: true, fullNameLo: true, avatarUrl: true, phoneNumber: true },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const parentsMap = new Map<number, any>();

      const processClass = (cls: any) => {
        cls.classStudents.forEach((cs: any) => {
          const student = cs.student;
          student.parentStudents.forEach((ps: any) => {
            const pUser = ps.parent?.user;
            if (pUser && !parentsMap.has(pUser.userId)) {
              parentsMap.set(pUser.userId, {
                userId: pUser.userId,
                fullNameEn: pUser.fullNameEn,
                fullNameLo: pUser.fullNameLo,
                avatarUrl: pUser.avatarUrl,
                role: 'Parent',
                studentId: student.studentId,
                studentName: student.fullNameEn,
              });
            }
          });
        });
      };

      teacherUser?.classes.forEach(processClass);
      teacherUser?.taughtClassSubjects.forEach((tcs) => {
        if (tcs.class) processClass(tcs.class);
      });

      // If no student classes linked yet, fallback to any registered parents so demo always works!
      if (parentsMap.size === 0) {
        const anyParents = await prisma.user.findMany({
          where: { role: { roleName: { in: ['Parent', 'parent'] } }, userId: { not: userId } },
          select: { userId: true, fullNameEn: true, fullNameLo: true, avatarUrl: true },
          take: 10,
        });
        for (const p of anyParents) {
          parentsMap.set(p.userId, {
            userId: p.userId,
            fullNameEn: p.fullNameEn,
            fullNameLo: p.fullNameLo,
            avatarUrl: p.avatarUrl,
            role: 'Parent',
          });
        }
      }

      return Array.from(parentsMap.values());
    }
  }
}

export default new ChatRepository();
