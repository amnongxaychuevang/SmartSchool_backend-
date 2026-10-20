import { PrismaClient  } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { LAO_PROVINCES } from './data/laoDivisions';
const prisma = new PrismaClient();

async function main() {
  // Always seed roles (safe with upsert)
  // The three built-in roles; each signs in to its own portal and cannot be deleted.
  const roles = [
    { code: 'admin', nameEn: 'Admin', nameLo: 'ແອັດມິນ', portal: 'admin' as const, isSystem: true },
    { code: 'teacher', nameEn: 'Teacher', nameLo: 'ອາຈານ', portal: 'teacher' as const, isSystem: true },
    { code: 'parent', nameEn: 'Parent', nameLo: 'ຜູ້ປົກຄອງ', portal: 'parent' as const, isSystem: true }
  ];

  let adminRole = null;
  for (const role of roles) {
    const r = await prisma.role.upsert({
      where: { code: role.code },
      update: { portal: role.portal, isSystem: true },
      create: role
    });
    if (role.code === 'admin') adminRole = r;
  }
  console.log('Role options seeded ✓');

  // Default grade types (only if none exist yet — admins may rename or add their own).
  if ((await prisma.gradeType.count()) === 0) {
    await prisma.gradeType.createMany({
      data: [
        { typeNameEn: 'Monthly test', typeNameLo: 'ສອບເສັງປະຈຳເດືອນ', weightPercent: 20 },
        { typeNameEn: 'Midterm exam', typeNameLo: 'ສອບເສັງກາງພາກ', weightPercent: 30 },
        { typeNameEn: 'Final exam', typeNameLo: 'ສອບເສັງທ້າຍພາກ', weightPercent: 40 },
        { typeNameEn: 'Homework / participation', typeNameLo: 'ວຽກບ້ານ / ການມີສ່ວນຮ່ວມ', weightPercent: 10 },
      ],
    });
    console.log('Grade types seeded ✓');
  }

  // Ethnicities (reference list for dropdowns). Upsert by code so re-running
  // keeps names up to date without duplicating rows or breaking student links.
  const ethnicities = [
    { code: 'laoLoum', nameLo: 'ລາວລຸ່ມ', nameEn: 'Lao Loum', sortOrder: 1 },
    { code: 'laoSoung', nameLo: 'ລາວສູງ', nameEn: 'Lao Soung', sortOrder: 2 },
    { code: 'laoTerng', nameLo: 'ລາວເທິງ', nameEn: 'Lao Terng', sortOrder: 3 },
  ];
  for (const e of ethnicities) {
    await prisma.ethnicity.upsert({ where: { code: e.code }, update: e, create: e });
  }
  console.log('Ethnicities seeded ✓');

  // Provinces & districts, with fixed ids so student links stay valid across re-seeds.
  for (const { districts, id, ...p } of LAO_PROVINCES) {
    await prisma.province.upsert({ where: { provinceId: id }, update: p, create: { provinceId: id, ...p } });
    for (const { id: districtId, ...d } of districts) {
      const data = { ...d, provinceId: id };
      await prisma.district.upsert({ where: { districtId }, update: data, create: { districtId, ...data } });
    }
  }
  console.log('Provinces & districts seeded ✓');

  // Seed admin user only if not yet created
  const existingAdmin = await prisma.user.findFirst({
    where: { email: 'admin@smartschool.com' }
  });

  if (existingAdmin) {
    console.log('Admin user already exists, skipping.');
    return;
  }

  const passwordHash = await bcrypt.hash('password123', 10);
  
  await prisma.user.create({
    data: {
      fullNameEn: 'System Admin',
      fullNameLo: 'ຜູ້ເບິ່ງແຍງລະບົບ',
      email: 'admin@smartschool.com',
      phoneNumber: '+856 20 5555 5555',
      passwordHash,
      roleId: adminRole.roleId,
      isActive: true,
      langPref: 'lo',
    }
  });

  console.log('Admin user created: admin@smartschool.com / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
