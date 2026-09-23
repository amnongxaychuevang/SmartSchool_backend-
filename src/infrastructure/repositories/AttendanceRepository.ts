import prisma from '../database/PrismaClient';

class AttendanceRepository {
  /**
   * Get the most recent attendance log for a student, today only.
   * Used to decide whether a new scan should be recorded as check-in or check-out.
   */
  async getLastLogToday(studentId) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    return prisma.attendanceLog.findFirst({
      where: {
        studentId: parseInt(studentId),
        logTime: { gte: startOfDay },
      },
      orderBy: { logTime: 'desc' },
    });
  }

  async create(data) {
    return prisma.attendanceLog.create({
      data: {
        studentId: parseInt(data.studentId),
        cardId: data.cardId != null ? parseInt(data.cardId) : null,
        logType: data.logType,
        gateLocationEn: data.gateLocationEn ?? null,
        gateLocationLo: data.gateLocationLo ?? null,
        isManualEntry: data.isManualEntry ?? false,
        manualEntryBy: data.manualEntryBy ?? null,
      },
    });
  }
}

export default new AttendanceRepository();
