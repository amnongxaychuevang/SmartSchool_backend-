import prisma from '../database/PrismaClient';
import dailyAttendanceRepository from './DailyAttendanceRepository';

class LeaveRequestRepository {
  async findMany({ studentId, homeroomTeacherId, status, search, page = 1, limit = 20 }: any = {}) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (studentId) where.studentId = parseInt(studentId);
    if (status) where.status = status;
    if (search) {
      where.student = {
        OR: [
          { fullNameLo: { contains: search } },
          { fullNameEn: { contains: search } },
          { studentCode: { contains: search } },
        ],
      };
    }

    if (homeroomTeacherId) {
      // Find classes where this teacher is homeroom teacher
      const homeroomClasses = await prisma.class.findMany({
        where: { homeroomTeacherId: parseInt(homeroomTeacherId) },
        select: { classId: true }
      });
      const classIds = homeroomClasses.map(c => c.classId);

      // Find students in those classes
      const classStudents = await prisma.classStudent.findMany({
        where: { classId: { in: classIds }, leftAt: null },
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
          student: {
            select: {
              studentCode: true, fullNameEn: true, fullNameLo: true, photoUrl: true,
              classStudents: { where: { leftAt: null }, take: 1, orderBy: { enrolledAt: 'desc' }, select: { class: { select: { classNameEn: true, classNameLo: true } } } },
            },
          },
          parent: { select: { fullNameEn: true, fullNameLo: true, phoneNumber: true } },
          approver: { select: { fullNameEn: true, fullNameLo: true } }
        }
      }),
      prisma.leaveRequest.count({ where })
    ]);

    return { requests, total, page: parseInt(page), limit: parseInt(limit) };
  }

  // homeroomTeacherId: when a teacher decides, the student must be in one of their homeroom classes.
  async updateStatus(leaveId, status, approvedBy, homeroomTeacherId: number | null = null) {
    const id = parseInt(leaveId);
    if (homeroomTeacherId) {
      const request = await prisma.leaveRequest.findUnique({ where: { leaveId: id }, select: { studentId: true } });
      if (!request) throw Object.assign(new Error('Leave request not found'), { statusCode: 404 });
      const inHomeroom = await prisma.classStudent.findFirst({
        where: { studentId: request.studentId, leftAt: null, class: { homeroomTeacherId } },
        select: { studentId: true },
      });
      if (!inHomeroom) throw Object.assign(new Error('This student is not in your homeroom class'), { statusCode: 403 });
    }
    return prisma.$transaction(async (tx) => {
      // Conditional update so a request can't be approved twice (or flipped after a decision).
      const claimed = await tx.leaveRequest.updateMany({
        where: { leaveId: id, status: 'pending' },
        data: { status, approvedBy: parseInt(approvedBy), processedAt: new Date() },
      });
      if (claimed.count === 0) {
        const exists = await tx.leaveRequest.findUnique({ where: { leaveId: id }, select: { leaveId: true } });
        throw Object.assign(new Error(exists ? 'Request is not pending' : 'Leave request not found'), { statusCode: exists ? 409 : 404 });
      }

      const request = await tx.leaveRequest.findUniqueOrThrow({
        where: { leaveId: id },
        include: { student: { select: { studentCode: true, fullNameEn: true, fullNameLo: true } } },
      });
      if (status === 'approved') {
        await dailyAttendanceRepository.markLeave(tx, request.studentId, request.startDate, request.endDate);
      }
      return request;
    });
  }
}

export default new LeaveRequestRepository();
