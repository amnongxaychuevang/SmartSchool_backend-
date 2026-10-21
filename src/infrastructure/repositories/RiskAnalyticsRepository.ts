import prisma from '../database/PrismaClient';
import { evaluateStudentRisk, RiskLevel } from '../../domain/atRiskAnalytics';
import { calculateConductScore } from '../../domain/conductScore';

export class RiskAnalyticsRepository {
  async runAssessment(params?: { classId?: number }) {
    const studentWhere: any = { status: 'active' };
    if (params?.classId) {
      studentWhere.classStudents = {
        some: { classId: params.classId },
      };
    }

    const students = await prisma.student.findMany({
      where: studentWhere,
      include: {
        classStudents: {
          include: {
            class: {
              include: { homeroomTeacher: true },
            },
          },
        },
        behaviorRecords: true,
        grades: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        dailyAttendance: {
          orderBy: { date: 'desc' },
          take: 30,
        },
      },
    });

    const results = [];
    const now = new Date();

    for (const student of students) {
      // 1. Attendance Metrics (last 30 recorded days)
      const attendance = student.dailyAttendance || [];
      const totalDays = attendance.length;
      const absentDays = attendance.filter((a) => a.status === 'absent').length;
      const lateDays = attendance.filter((a) => a.status === 'late').length;

      let consecutiveAbsences = 0;
      for (const record of attendance) {
        if (record.status === 'absent') {
          consecutiveAbsences++;
        } else {
          break; // consecutive streak broken
        }
      }

      // 2. Academic Metrics
      const grades = student.grades || [];
      const totalSubjects = grades.length;
      let failingSubjects = 0;
      let scoreSum = 0;

      for (const g of grades) {
        const val = Number(g.score);
        scoreSum += val;
        if (val < 50) failingSubjects++;
      }
      const averageScore = totalSubjects > 0 ? scoreSum / totalSubjects : 80;

      // 3. Behavior Metrics
      const behaviors = student.behaviorRecords || [];
      const conduct = calculateConductScore(behaviors.map((b) => ({ type: b.type, points: b.points })));
      const demeritCount = behaviors.filter((b) => b.type === 'demerit').length;
      const severeDemerits = behaviors.filter((b) => b.type === 'demerit' && b.points >= 20).length;

      // 4. Run pure domain evaluation
      const evaluation = evaluateStudentRisk({
        studentId: student.studentId,
        studentNameEn: student.fullNameEn,
        studentNameLo: student.fullNameLo,
        attendance: {
          totalDays,
          absentDays,
          lateDays,
          consecutiveAbsences,
        },
        academic: {
          totalSubjects,
          failingSubjects,
          averageScore,
        },
        behavior: {
          conductScore: conduct.finalScore,
          demeritCount,
          severeDemerits,
        },
      });

      // 5. Check if notification to homeroom teacher is required
      const homeroomTeacher = student.classStudents[0]?.class?.homeroomTeacher;
      const shouldNotifyTeacher = evaluation.riskLevel === 'high' && !!homeroomTeacher;

      // Upsert latest assessment
      const assessment = await prisma.studentRiskAssessment.create({
        data: {
          studentId: student.studentId,
          riskLevel: evaluation.riskLevel,
          riskScore: evaluation.riskScore,
          factors: evaluation.factors as any,
          assessedAt: now,
          teacherNotified: shouldNotifyTeacher,
          teacherNotifiedAt: shouldNotifyTeacher ? now : null,
        },
      });

      // Send in-app notification to homeroom teacher
      if (shouldNotifyTeacher && homeroomTeacher) {
        const factorSummaryLo = evaluation.factors.map((f) => f.messageLo).join(', ');
        const factorSummaryEn = evaluation.factors.map((f) => f.messageEn).join(', ');

        const teacherMsgEn = `⚠️ High-Risk Student Alert: ${student.fullNameEn} (${student.classStudents[0]?.class?.nameEn}) has been flagged for high risk. Reasons: ${factorSummaryEn}. Please review and intervene.`;
        const teacherMsgLo = `⚠️ ແຈ້ງເຕືອນນັກຮຽນກຸ່ມສ່ຽງ: ນ້ອງ ${student.fullNameLo} (${student.classStudents[0]?.class?.nameLo}) ຖືກລະບົບຈັດເຂົ້າກຸ່ມສ່ຽງສູງ. ສາເຫດ: ${factorSummaryLo}. ກະລຸນາກວດສອບ ແລະ ວາງແຜນຊ່ວຍເຫຼືອ.`;

        prisma.notification.create({
          data: {
            recipientUserId: homeroomTeacher.userId,
            studentId: student.studentId,
            type: 'at_risk',
            channel: 'app_push',
            status: 'sent',
            deliveredAt: now,
            messageEn: teacherMsgEn,
            messageLo: teacherMsgLo,
          },
        }).catch((err) => console.error('[RiskAnalytics] Error notifying teacher:', err));
      }

      results.push({
        ...evaluation,
        assessmentId: assessment.assessmentId,
        teacherNotified: shouldNotifyTeacher,
      });
    }

    return results;
  }

  async listAtRiskStudents(query: {
    classId?: number;
    riskLevel?: RiskLevel;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.riskLevel) where.riskLevel = query.riskLevel;
    if (query.classId) {
      where.student = {
        classStudents: { some: { classId: query.classId } },
      };
    }

    // Get latest assessment for each student
    const [total, assessments] = await Promise.all([
      prisma.studentRiskAssessment.count({ where }),
      prisma.studentRiskAssessment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ riskScore: 'desc' }, { assessedAt: 'desc' }],
        include: {
          student: {
            select: {
              studentId: true,
              studentCode: true,
              fullNameEn: true,
              fullNameLo: true,
              photoUrl: true,
              classStudents: {
                select: {
                  class: {
                    select: {
                      classId: true,
                      nameEn: true,
                      nameLo: true,
                      homeroomTeacher: { select: { fullNameEn: true, fullNameLo: true } },
                    },
                  },
                },
              },
            },
          },
          interventions: {
            orderBy: { actionDate: 'desc' },
            take: 1,
          },
        },
      }),
    ]);

    return {
      assessments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getStudentRiskDetail(studentId: number) {
    const student = await prisma.student.findUnique({
      where: { studentId },
      include: {
        classStudents: {
          include: {
            class: {
              include: { homeroomTeacher: true },
            },
          },
        },
        dailyAttendance: {
          orderBy: { date: 'desc' },
          take: 30,
        },
        grades: {
          orderBy: { createdAt: 'desc' },
          include: {
            subject: true,
            gradeType: true,
          },
        },
        behaviorRecords: {
          orderBy: { incidentDate: 'desc' },
          include: { category: true },
        },
        riskAssessments: {
          orderBy: { assessedAt: 'desc' },
          take: 5,
        },
        interventions: {
          orderBy: { actionDate: 'desc' },
          include: { actor: { select: { userId: true, fullNameEn: true, fullNameLo: true } } },
        },
      },
    });

    if (!student) {
      throw Object.assign(new Error('Student not found'), { statusCode: 404 });
    }

    const conduct = calculateConductScore(
      student.behaviorRecords.map((b) => ({ type: b.type, points: b.points }))
    );

    return {
      student,
      conductSummary: conduct,
      latestAssessment: student.riskAssessments[0] || null,
      interventions: student.interventions,
    };
  }

  async createIntervention(
    data: {
      studentId: number;
      assessmentId?: number;
      title: string;
      description: string;
      status?: string;
      notes?: string;
    },
    actionBy?: number
  ) {
    return prisma.riskIntervention.create({
      data: {
        studentId: data.studentId,
        assessmentId: data.assessmentId,
        title: data.title,
        description: data.description,
        status: data.status ?? 'pending',
        actionBy,
        actionDate: new Date(),
        notes: data.notes,
      },
      include: {
        student: true,
        actor: { select: { fullNameEn: true, fullNameLo: true } },
      },
    });
  }

  async updateIntervention(
    interventionId: number,
    data: {
      title?: string;
      description?: string;
      status?: string;
      notes?: string;
    }
  ) {
    return prisma.riskIntervention.update({
      where: { interventionId },
      data,
    });
  }

  async getOverview() {
    const latestAssessments = await prisma.studentRiskAssessment.groupBy({
      by: ['riskLevel'],
      _count: { assessmentId: true },
    });

    const counts: Record<string, number> = { high: 0, medium: 0, low: 0 };
    for (const group of latestAssessments) {
      counts[group.riskLevel] = group._count.assessmentId;
    }

    const totalAssessed = counts.high + counts.medium + counts.low;
    const pendingInterventions = await prisma.riskIntervention.count({
      where: { status: 'pending' },
    });

    return {
      totalAssessed,
      highRiskCount: counts.high,
      mediumRiskCount: counts.medium,
      lowRiskCount: counts.low,
      pendingInterventions,
    };
  }
}

export default new RiskAnalyticsRepository();
