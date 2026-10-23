import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding new features data...');

  // 1. Behavior Categories
  const categories = [
    { nameEn: 'Helping Community & Peers', nameLo: 'ຊ່ວຍເຫຼືອສັງຄົມ ແລະ ໝູ່ເພື່ອນ', type: 'merit' as const, defaultPoints: 10, severity: 'low' },
    { nameEn: 'Academic Dedication & Excellence', nameLo: 'ຜົນການຮຽນດີເດັ່ນ / ຕັ້ງໃຈຮຽນ', type: 'merit' as const, defaultPoints: 10, severity: 'low' },
    { nameEn: 'Punctuality & Good Conduct', nameLo: 'ມາຮຽນທັນເວລາ ແລະ ປະຕິບັດລະບຽບດີ', type: 'merit' as const, defaultPoints: 5, severity: 'low' },
    { nameEn: 'Honesty & Integrity', nameLo: 'ຄວາມຊື່ສັດ ແລະ ສັດຊື່', type: 'merit' as const, defaultPoints: 15, severity: 'low' },
    { nameEn: 'Environmental Care', nameLo: 'ການຮັກສາຄວາມສະອາດ ແລະ ສິ່ງແວດລ້ອມ', type: 'merit' as const, defaultPoints: 5, severity: 'low' },
    { nameEn: 'Unexcused Tardy / Late', nameLo: 'ມາໂຮງຮຽນຊ້າໂດຍບໍ່ມີເຫດຜົນ', type: 'demerit' as const, defaultPoints: 5, severity: 'low' },
    { nameEn: 'Dress Code Violation', nameLo: 'ບໍ່ນຸ່ງຖືຕາມລະບຽບແບບແຜນ', type: 'demerit' as const, defaultPoints: 5, severity: 'low' },
    { nameEn: 'Unauthorized Phone Usage', nameLo: 'ຫຼິ້ນໂທລະສັບໃນເວລາຮຽນ', type: 'demerit' as const, defaultPoints: 10, severity: 'medium' },
    { nameEn: 'Truancy / Skipping Class', nameLo: 'ໂດດຮຽນ / ອອກນອກໂຮງຮຽນໂດຍບໍ່ໄດ້ຮັບອະນຸຍາດ', type: 'demerit' as const, defaultPoints: 20, severity: 'high' },
    { nameEn: 'Fighting / Disrespect', nameLo: 'ທະເລາະວິວາດ / ບໍ່ເຄົາລົບຄູອາຈານ', type: 'demerit' as const, defaultPoints: 30, severity: 'high' },
  ];

  for (const cat of categories) {
    const existing = await prisma.behaviorCategory.findFirst({
      where: { nameEn: cat.nameEn },
    });
    if (!existing) {
      await prisma.behaviorCategory.create({ data: cat });
    }
  }
  console.log('Behavior categories seeded ✓');

  // 2. Bus Vehicles & Routes
  const vehicle1 = await prisma.busVehicle.upsert({
    where: { plateNumber: 'ກກ 1234' },
    update: {},
    create: {
      plateNumber: 'ກກ 1234',
      model: 'Toyota Commuter (VIP)',
      capacity: 15,
      driverName: 'ທ້າວ ຄຳຫຼ້າ ວົງສຸວັນ',
      driverPhone: '020 5551 2233',
      status: 'active',
    },
  });

  const vehicle2 = await prisma.busVehicle.upsert({
    where: { plateNumber: 'ຂຂ 5678' },
    update: {},
    create: {
      plateNumber: 'ຂຂ 5678',
      model: 'Hyundai County Mini-Bus',
      capacity: 25,
      driverName: 'ທ້າວ ສົມພອນ ແກ້ວມະນີ',
      driverPhone: '020 5552 4466',
      status: 'active',
    },
  });

  const route1 = await prisma.busRoute.upsert({
    where: { routeId: 1 },
    update: {},
    create: {
      routeNameEn: 'Route A: Dongdok - Dongpalan - School',
      routeNameLo: 'ສາຍ A: ດົງໂດກ - ດົງປ່າລານ - ໂຮງຮຽນ',
      vehicleId: vehicle1.vehicleId,
      description: 'Morning pickup from 06:45 AM, afternoon dropoff at 16:30 PM',
      stops: [
        { nameEn: 'Dongdok Market', nameLo: 'ຕະຫຼາດດົງໂດກ', time: '06:45' },
        { nameEn: 'Dongpalan Junction', nameLo: 'ສີ່ແຍກດົງປ່າລານ', time: '07:05' },
        { nameEn: 'Campus Gate 1', nameLo: 'ປະຕູໂຮງຮຽນ 1', time: '07:25' },
      ],
      isActive: true,
    },
  });

  const route2 = await prisma.busRoute.upsert({
    where: { routeId: 2 },
    update: {},
    create: {
      routeNameEn: 'Route B: Thadeua - KM4 - School',
      routeNameLo: 'ສາຍ B: ທ່າເດື່ອ - ຫຼັກ 4 - ໂຮງຮຽນ',
      vehicleId: vehicle2.vehicleId,
      description: 'Covers southern residential sector',
      stops: [
        { nameEn: 'Thadeua Center', nameLo: 'ສູນກາງທ່າເດື່ອ', time: '06:40' },
        { nameEn: 'KM 4 Traffic Lights', nameLo: 'ໄຟແດງຫຼັກ 4', time: '07:00' },
        { nameEn: 'Campus Gate 2', nameLo: 'ປະຕູໂຮງຮຽນ 2', time: '07:20' },
      ],
      isActive: true,
    },
  });
  console.log('Bus vehicles and routes seeded ✓');

  // 3. Book Categories & Books
  const bookCategories = [
    { nameEn: 'Science & Technology', nameLo: 'ວິທະຍາສາດ ແລະ ເຕັກໂນໂລຊີ' },
    { nameEn: 'Mathematics', nameLo: 'ຄະນິດສາດ' },
    { nameEn: 'Literature & Language', nameLo: 'ວັນນະຄະດີ ແລະ ພາສາ' },
    { nameEn: 'History & Culture', nameLo: 'ປະຫວັດສາດ ແລະ ວັດທະນະທຳ' },
    { nameEn: 'General Knowledge & Fiction', nameLo: 'ຄວາມຮູ້ທົ່ວໄປ ແລະ ນິທານ' },
  ];

  const catMap: Record<string, number> = {};
  for (const bc of bookCategories) {
    const existing = await prisma.bookCategory.findFirst({ where: { nameEn: bc.nameEn } });
    if (existing) {
      catMap[bc.nameEn] = existing.categoryId;
    } else {
      const created = await prisma.bookCategory.create({ data: bc });
      catMap[bc.nameEn] = created.categoryId;
    }
  }

  const sampleBooks = [
    {
      isbn: '978-99900-1-01',
      titleEn: 'General Science & Nature M.4',
      titleLo: 'ວິທະຍາສາດທຳມະຊາດ ຊັ້ນ ມ.4',
      author: 'Ministry of Education and Sports',
      publisher: 'State Education Publishing House',
      publishYear: 2024,
      categoryId: catMap['Science & Technology'],
      shelfLocation: 'SCI-A1',
      totalCopies: 10,
    },
    {
      isbn: '978-99900-1-02',
      titleEn: 'Modern Mathematics for Secondary School',
      titleLo: 'ຄະນິດສາດທັນສະໄໝ ຊັ້ນມັດທະຍົມ',
      author: 'Dr. Somphone Saysana',
      publisher: 'National University of Laos Press',
      publishYear: 2025,
      categoryId: catMap['Mathematics'],
      shelfLocation: 'MATH-B2',
      totalCopies: 8,
    },
    {
      isbn: '978-99900-1-03',
      titleEn: 'Lao Literature and Masterpieces',
      titleLo: 'ວັນນະຄະດີລາວ ແລະ ບົດປະພັນດີເດັ່ນ',
      author: 'Department of Literature',
      publisher: 'Lao Writers Association',
      publishYear: 2023,
      categoryId: catMap['Literature & Language'],
      shelfLocation: 'LIT-C1',
      totalCopies: 12,
    },
    {
      isbn: '978-99900-1-04',
      titleEn: 'English Grammar in Action - Level 3',
      titleLo: 'ໄວຍາກອນພາສາອັງກິດພາກປະຕິບັດ - ລະດັບ 3',
      author: 'Michael R. Davies',
      publisher: 'Cambridge Learning Press',
      publishYear: 2024,
      categoryId: catMap['Literature & Language'],
      shelfLocation: 'ENG-D3',
      totalCopies: 15,
    },
    {
      isbn: '978-99900-1-05',
      titleEn: 'Chronicles of Lan Xang Kingdom',
      titleLo: 'ປະຫວັດສາດອານາຈັກລ້ານຊ້າງ',
      author: 'Prof. Bounpone Sihavong',
      publisher: 'Historical Research Institute',
      publishYear: 2022,
      categoryId: catMap['History & Culture'],
      shelfLocation: 'HIST-E1',
      totalCopies: 6,
    },
  ];

  for (const b of sampleBooks) {
    const existing = await prisma.book.findUnique({ where: { isbn: b.isbn } });
    if (!existing) {
      await prisma.book.create({
        data: {
          ...b,
          availableCopies: b.totalCopies,
          status: 'available',
        },
      });
    }
  }
  console.log('Books seeded ✓');

  // 4. Connect 1-2 students to bus and create sample behavior/loan records if students exist
  const firstStudents = await prisma.student.findMany({ take: 3 });
  if (firstStudents.length > 0) {
    // Assign student 1 to route 1
    await prisma.busStudent.upsert({
      where: { studentId: firstStudents[0].studentId },
      update: {},
      create: {
        studentId: firstStudents[0].studentId,
        routeId: route1.routeId,
        vehicleId: vehicle1.vehicleId,
        pickupStop: 'Dongdok Market',
        dropoffStop: 'Campus Gate 1',
        isActive: true,
      },
    });

    // Add a merit record
    const meritCat = await prisma.behaviorCategory.findFirst({ where: { type: 'merit' } });
    if (meritCat) {
      await prisma.behaviorRecord.create({
        data: {
          studentId: firstStudents[0].studentId,
          categoryId: meritCat.categoryId,
          type: 'merit',
          titleEn: 'Helped clean classroom and organize books',
          titleLo: 'ຊ່ວຍອະນາໄມຫ້ອງຮຽນ ແລະ ຈັດປຶ້ມຢ່າງເປັນລະບຽບ',
          points: 10,
          actionTaken: 'Certificate of praise',
          notifyParent: false,
        },
      });
    }
    console.log('Sample student bus & behavior assigned ✓');
  }

  // 6. Summer Courses Seed
  const summerCourses = [
    { academicYear: '2025-2026', subjectNameLo: 'ຄະນິດສາດ (Mathematics)', subjectNameEn: 'Mathematics', gradeLevel: 'ປ.1 - ປ.5', monthlyFee: 200000, teacherName: 'ອາຈານ ສົມສັກ', roomNumber: 'ຫ້ອງ 201', timeSlot: '08:30 - 10:00 (ຈັນ - ສຸກ)' },
    { academicYear: '2025-2026', subjectNameLo: 'ພາສາລາວ (Lao Language)', subjectNameEn: 'Lao Language', gradeLevel: 'ປ.1 - ປ.5', monthlyFee: 180000, teacherName: 'ອາຈານ ບົວຄຳ', roomNumber: 'ຫ້ອງ 202', timeSlot: '10:15 - 11:45 (ຈັນ - ສຸກ)' },
    { academicYear: '2025-2026', subjectNameLo: 'ພາສາອັງກິດ (English for Kids)', subjectNameEn: 'English for Kids', gradeLevel: 'ທຸກລະດັບ', monthlyFee: 250000, teacherName: 'Teacher Johnny', roomNumber: 'ຫ້ອງ 103', timeSlot: '13:30 - 15:00 (ຈັນ - ສຸກ)' },
    { academicYear: '2025-2026', subjectNameLo: 'ວິທະຍາສາດ ແລະ ການທົດລອງ (Fun Science)', subjectNameEn: 'Fun Science', gradeLevel: 'ປ.3 - ມ.2', monthlyFee: 200000, teacherName: 'ອາຈານ ວຽງໄຊ', roomNumber: 'ຫ້ອງ Lab 1', timeSlot: '15:15 - 16:45 (ຈັນ - ສຸກ)' },
    { academicYear: '2025-2026', subjectNameLo: 'ສິລະປະ ແລະ ແຕ້ມຮູບ (Arts & Crafts)', subjectNameEn: 'Arts & Crafts', gradeLevel: 'ອະນຸບານ - ປະຖົມ', monthlyFee: 180000, teacherName: 'ອາຈານ ມະລິ', roomNumber: 'ຫ້ອງ ສິລະປະ', timeSlot: '10:00 - 11:30 (ຈັນ - ສຸກ)' },
  ];

  for (const c of summerCourses) {
    const existing = await prisma.summerCourse.findFirst({
      where: { subjectNameEn: c.subjectNameEn, academicYear: c.academicYear },
    });
    if (!existing) {
      await prisma.summerCourse.create({ data: c });
    }
  }
  console.log('Summer courses seeded ✓');

  console.log('All feature seeds completed successfully! 🎉');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
