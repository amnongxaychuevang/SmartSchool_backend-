import prisma from "../database/PrismaClient";
import emailService from "./EmailService";
import whatsAppService from "./WhatsAppService";

class NotificationDispatcher {
  async dispatch(notificationId: number): Promise<void> {
    const notification = await prisma.notification.findUnique({
      where: { notificationId },
      include: {
        recipient: {
          select: {
            userId: true,
            phoneNumber: true,
            email: true,
            langPref: true,
          },
        },
      },
    });
    if (!notification || notification.status !== "pending") return;

    const message =
      notification.recipient.langPref === "lo"
        ? notification.messageLo
        : notification.messageEn;

    let success = false;
    let errorMessage: string | undefined;

    try {
      switch (notification.channel) {
        case "whatsapp": {
          const phone = notification.recipient.phoneNumber;
          if (!phone) {
            errorMessage = "Recipient has no phone number";
            break;
          }
          const result = await whatsAppService.sendTextMessage(phone, message);
          success = result.success;
          errorMessage = result.error;
          break;
        }
        case "email": {
          const email = notification.recipient.email;
          if (!email) {
            errorMessage = "Recipient has no email address";
            break;
          }
          const result = await emailService.sendMail({
            to: email,
            subject: notification.type,
            text: message,
          });
          success = result.success;
          errorMessage = result.error;
          break;
        }
        case "app_push":
        default:
          errorMessage = `Channel "${notification.channel}" not implemented yet`;
          break;
      }
    } catch (err: any) {
      errorMessage = err.message;
    }

    await prisma.notification.update({
      where: { notificationId },
      data: {
        status: success ? "sent" : "failed",
        deliveredAt: success ? new Date() : undefined,
        errorMessage: errorMessage || undefined,
      },
    });
  }

  async dispatchAllPending(): Promise<number> {
    const pending = await prisma.notification.findMany({
      where: { status: "pending" },
      select: { notificationId: true },
      take: 100,
      orderBy: { sentAt: "asc" },
    });

    let dispatched = 0;
    for (const n of pending) {
      await this.dispatch(n.notificationId);
      dispatched++;
    }
    return dispatched;
  }

  async notifyParents(
    studentId: number,
    type:
      | "check_in"
      | "check_out"
      | "absence"
      | "grade"
      | "transaction"
      | "general",
    messageEn: string,
    messageLo: string,
  ): Promise<number> {
    const channelSetting = await prisma.schoolSetting.findUnique({
      where: { key: "notificationChannel" },
    });
    const channel = (channelSetting?.value as any)?.default === "email" ? "email" : "whatsapp";

    const student = await prisma.student.findUnique({
      where: { studentId },
      select: {
        parentStudents: { select: { parentUserId: true } },
      },
    });
    if (!student || student.parentStudents.length === 0) return 0;

    // One create per parent: createManyAndReturn is not supported on MySQL.
    const notifications = await prisma.$transaction(
      student.parentStudents.map((link) =>
        prisma.notification.create({
          data: {
            recipientUserId: link.parentUserId,
            studentId,
            type,
            channel,
            status: "pending",
            messageEn,
            messageLo,
          },
        }),
      ),
    );

    for (const n of notifications) {
      this.dispatch(n.notificationId).catch((err) =>
        console.error(
          `[Dispatcher] Failed notificationId=${n.notificationId}:`,
          err.message,
        ),
      );
    }

    return notifications.length;
  }
}

export default new NotificationDispatcher();
