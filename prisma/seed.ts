import { PrismaClient  } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();

async function main() {
  // Always seed gender options (safe with upsert)
  const genders = [
    { code: 'male', nameEn: 'Male', nameLo: 'ຊາຍ' },
    { code: 'female', nameEn: 'Female', nameLo: 'ຍິງ' },
    { code: 'other', nameEn: 'Other', nameLo: 'ອື່ນໆ' }
  ];

  for (const gender of genders) {
    await prisma.gender.upsert({
      where: { code: gender.code },
      update: {},
      create: gender
    });
  }
  console.log('Gender options seeded ✓');

  // Always seed roles (safe with upsert)
  const roles = [
    { code: 'admin', nameEn: 'Admin', nameLo: 'ແອັດມິນ' },
    { code: 'teacher', nameEn: 'Teacher', nameLo: 'ອາຈານ' },
    { code: 'parent', nameEn: 'Parent', nameLo: 'ຜູ້ປົກຄອງ' }
  ];

  let adminRole = null;
  for (const role of roles) {
    const r = await prisma.role.upsert({
      where: { code: role.code },
      update: {},
      create: role
    });
    if (role.code === 'admin') adminRole = r;
  }
  console.log('Role options seeded ✓');

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
      phoneNumber: '02055555555',
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
