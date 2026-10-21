import prisma from '../database/PrismaClient';

export class SchoolRepository {
  async ensureDefaultSchool() {
    const count = await prisma.school.count();
    if (count === 0) {
      await prisma.school.create({
        data: {
          schoolCode: 'main-school',
          nameEn: 'Vientiane Smart Academy',
          nameLo: 'ໂຮງຮຽນ ສະມາດ ອະຄາເດມີ ວຽງຈັນ',
          phone: '+856 20 5555 8899',
          email: 'contact@smartacademy.la',
          addressEn: 'Dongdok Campus, Vientiane Capital',
          addressLo: 'ວິທະຍາເຂດດົງໂດກ, ນະຄອນຫຼວງວຽງຈັນ',
          plan: 'enterprise',
          status: 'active',
          maxStudents: 2000,
        },
      });
    }
  }

  async listSchools() {
    await this.ensureDefaultSchool();

    const [schools, totalStudents, totalTeachers, totalClasses] = await Promise.all([
      prisma.school.findMany({
        orderBy: { schoolId: 'asc' },
      }),
      prisma.student.count({ where: { status: 'active' } }),
      prisma.teacher.count(),
      prisma.class.count(),
    ]);

    // Enrich schools with stats
    return schools.map((s, idx) => ({
      ...s,
      stats: {
        studentCount: idx === 0 ? totalStudents : 0,
        teacherCount: idx === 0 ? totalTeachers : 0,
        classCount: idx === 0 ? totalClasses : 0,
      },
    }));
  }

  async getSchool(schoolId: number) {
    return prisma.school.findUnique({
      where: { schoolId },
    });
  }

  async createSchool(data: {
    schoolCode: string;
    nameEn: string;
    nameLo: string;
    phone?: string;
    email?: string;
    addressEn?: string;
    addressLo?: string;
    logoUrl?: string;
    plan?: string;
    maxStudents?: number;
    settings?: any;
  }) {
    const existing = await prisma.school.findUnique({
      where: { schoolCode: data.schoolCode },
    });
    if (existing) {
      throw Object.assign(new Error('School code already exists'), { statusCode: 409 });
    }

    return prisma.school.create({
      data: {
        schoolCode: data.schoolCode,
        nameEn: data.nameEn,
        nameLo: data.nameLo,
        phone: data.phone,
        email: data.email,
        addressEn: data.addressEn,
        addressLo: data.addressLo,
        logoUrl: data.logoUrl,
        plan: data.plan ?? 'standard',
        status: 'active',
        maxStudents: data.maxStudents ?? 500,
        settings: data.settings,
      },
    });
  }

  async updateSchool(
    schoolId: number,
    data: {
      schoolCode?: string;
      nameEn?: string;
      nameLo?: string;
      phone?: string;
      email?: string;
      addressEn?: string;
      addressLo?: string;
      logoUrl?: string;
      plan?: string;
      status?: string;
      maxStudents?: number;
      settings?: any;
    }
  ) {
    return prisma.school.update({
      where: { schoolId },
      data,
    });
  }

  async deleteSchool(schoolId: number) {
    const count = await prisma.school.count();
    if (count <= 1) {
      throw Object.assign(new Error('Cannot delete the primary/default school'), { statusCode: 400 });
    }
    return prisma.school.delete({
      where: { schoolId },
    });
  }

  async getOverview() {
    await this.ensureDefaultSchool();
    const [schools, activeSchools, studentCount, teacherCount] = await Promise.all([
      prisma.school.count(),
      prisma.school.count({ where: { status: 'active' } }),
      prisma.student.count({ where: { status: 'active' } }),
      prisma.teacher.count(),
    ]);

    return {
      totalSchools: schools,
      activeSchools,
      totalStudentsAcrossNetwork: studentCount,
      totalTeachersAcrossNetwork: teacherCount,
    };
  }
}

export default new SchoolRepository();
