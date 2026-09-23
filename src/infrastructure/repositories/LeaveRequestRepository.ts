import prisma from '../database/PrismaClient';

class LeaveRequestRepository {
  async findMany({ studentId, homeroomTeacherId, status, page = 1, limit = 20 }: any = {}) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (studentId) where.studentId = parseInt(studentId);
    if (status) where.status = status;

    if (homeroomTeacherId) {
      // Find classes where this teacher is homeroom teacher
      const homeroomClasses = await prisma.class.findMany({
        where: { homeroomTeacherId: parseInt(homeroomTeacherId) },
        select: { classId: true }
      });
      const classIds = homeroomClasses.map(c => c.classId);

      // Find students in those classes
      const classStudents = await prisma.classStudent.findMany({
        where: { classId: { in: classIds } },
        select: { studentId: true }
      });
      const studentIds = classStudents.map(cs => cs.studentId);

      where.studentId = { in: studentIds };
    }

    const [requests, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { requestedAt: 'desc' },
        include: {
          student: { select: { studentCode: true, fullNameEn: true, fullNameLo: true } },
          parent: { select: { fullNameEn: true, fullNameLo: true, phoneNumber: true } },
          approver: { select: { fullNameEn: true, fullNameLo: true } }
        }
      }),
      prisma.leaveRequest.count({ where })
    ]);

    return { requests, total, page: parseInt(page), limit: parseInt(limit) };
  }

  async updateStatus(leaveId, status, approvedBy) {
    return prisma.leaveRequest.update({
      where: { leaveId: parseInt(leaveId) },
      data: {
        status,
        approvedBy: parseInt(approvedBy),
        processedAt: new Date()
      },
      include: {
        student: { select: { studentCode: true, fullNameEn: true, fullNameLo: true } }
      }
    });
  }
}

export default new LeaveRequestRepository();
