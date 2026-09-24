/*
 * Demo data for the development database.
 *
 *   npx ts-node -T prisma/seed-demo.ts           # seed once (skips if demo data exists)
 *   npx ts-node -T prisma/seed-demo.ts --reset   # delete demo data and seed again
 *
 * Every page reads this through the real API, so screens look populated
 * without any mock values in the frontend. Demo rows are recognisable and
 * removable: users use the @demo.smartschool.la domain, students the DEMO-
 * code prefix, subjects the DEMO- code prefix; everything else hangs off them.
 * Real records (the admin account, real parents/students) are never touched.
 *
 * Dates are relative to "now" on the school clock (Asia/Vientiane), so a
 * --reset brings attendance, wallet activity and requests up to date.
 * Randomness is seeded, so every run produces the same school.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  startOfSchoolDay, addDays, schoolDateValue, schoolDateString, academicYearForDate,
} from '../src/domain/schoolTime';

const prisma = new PrismaClient();

const DEMO_DOMAIN = '@demo.smartschool.la';
const DEMO_PASSWORD = 'password123';
const STUDENT_PREFIX = 'DEMO-';
const SUBJECT_PREFIX = 'DEMO-';

// ── Deterministic randomness ─────────────────────────────────────────────
let seed = 20260924;
function rand() {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
const pick = <T>(list: readonly T[]): T => list[Math.floor(rand() * list.length)];
const roundTo = (n: number, step: number) => Math.round(n / step) * step;

// ── School clock helpers ─────────────────────────────────────────────────
const NOW = new Date();
const TODAY = startOfSchoolDay(NOW); // UTC instant of 00:00 Vientiane
/** Instant for a Vientiane wall-clock time on the school day `day`. */
const at = (day: Date, hh: number, mm: number, ss = 0) =>
  new Date(day.getTime() + ((hh * 60 + mm) * 60 + ss) * 1000);
const weekday = (day: Date) => new Date(day.getTime() + 7 * 3600 * 1000).getUTCDay(); // 0 = Sunday
const isSchoolDay = (day: Date) => weekday(day) >= 1 && weekday(day) <= 5;
const toTime = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

// ── People ───────────────────────────────────────────────────────────────
const TEACHERS = [
  { key: 't1', lo: 'ບຸນມີ ໄຊຍະວົງ', en: 'Bounmy Xayavong', spec: 'Mathematics', qual: 'M.Sc. Mathematics, National University of Laos' },
  { key: 't2', lo: 'ສຸກສະຫວັນ ວົງພະຈັນ', en: 'Souksavanh Vongphachanh', spec: 'Lao Language & Literature', qual: 'B.A. Lao Literature, NUOL' },
  { key: 't3', lo: 'ສາຣາ ເຈັນກິນສ໌', en: 'Sarah Jenkins', spec: 'English', qual: 'B.Ed. TESOL' },
  { key: 't4', lo: 'ສົມສະນິດ ມະນີວົງ', en: 'Somsanith Manivong', spec: 'Physics', qual: 'M.Sc. Physics' },
  { key: 't5', lo: 'ວັນນະລີ ພົມມາ', en: 'Vannaly Phomma', spec: 'Chemistry & Biology', qual: 'B.Sc. Chemistry' },
  { key: 't6', lo: 'ຄຳຫຼ້າ ອິນທະລາດ', en: 'Khamla Inthalath', spec: 'History & IT', qual: 'B.Sc. Computer Science' },
] as const;

type G = 'male' | 'female';
const STUDENTS: { lo: string; en: string; g: G }[] = [
  { lo: 'ອານຸສອນ ພົມມະວົງ', en: 'Anousone Phommavong', g: 'male' },
  { lo: 'ມານິຕາ ແກ້ວມະນີ', en: 'Manita Keomany', g: 'female' },
  { lo: 'ສຸລິຍາ ຈິດປະເສີດ', en: 'Souliya Chitprasert', g: 'male' },
  { lo: 'ນິດຕະພອນ ແກ້ວມະນີ', en: 'Nitaphone Keomany', g: 'female' },
  { lo: 'ສົມສັກ ວົງໄຊ', en: 'Somsack Vongxay', g: 'male' },
  { lo: 'ມາລີ ສີສຸພັນ', en: 'Malee Sisouphanh', g: 'female' },
  { lo: 'ພູວົງ ຈັນທະລາ', en: 'Phouvong Chanthala', g: 'male' },
  { lo: 'ອາລິຍາ ພົມມະວົງ', en: 'Aliya Phommavong', g: 'female' },
  { lo: 'ວິໄລລັກ ສີຫາລາດ', en: 'Vilaylack Sihalath', g: 'female' },
  { lo: 'ສົມພອນ ຈັນທະວົງ', en: 'Somphone Chanthavong', g: 'male' },
  { lo: 'ບຸນມີ ເທບວົງສາ', en: 'Bounmy Thepvongsa', g: 'male' },
  { lo: 'ສຸກສາຄອນ ວໍລະຈິດ', en: 'Souksakhone Vorachit', g: 'male' },
  { lo: 'ຄຳລາ ພອນໄຊ', en: 'Khamla Phonxay', g: 'female' },
  { lo: 'ພອນທິບ ພົມມະວົງ', en: 'Phonethip Phommavong', g: 'female' },
  { lo: 'ສົມໄຊ ດວງດາລາ', en: 'Somxay Douangdara', g: 'male' },
  { lo: 'ດາວອນ ສີສຸລາດ', en: 'Davone Sisoulath', g: 'female' },
  { lo: 'ໄຊປັນຍາ ລັດຕະນະ', en: 'Xaypanya Rattana', g: 'male' },
  { lo: 'ມະນີວອນ ແສງຈັນ', en: 'Manivone Sengchanh', g: 'female' },
  { lo: 'ທອງສຸກ ແສງຈັນ', en: 'Thongsouk Sengchanh', g: 'male' },
  { lo: 'ແກ້ວກັນຍາ ສຸວັນນະສານ', en: 'Keokanya Souvannasane', g: 'female' },
  { lo: 'ຈັນທະລາ ວົງສາ', en: 'Chanthala Vongsa', g: 'female' },
  { lo: 'ວັນໄຊ ພົມມະຈັນ', en: 'Vanxay Phommachanh', g: 'male' },
  { lo: 'ນ້ອຍ ເທບວົງສາ', en: 'Noy Thepvongsa', g: 'female' },
  { lo: 'ຄຳພອນ ສີວົງໄຊ', en: 'Khamphone Sivongxay', g: 'male' },
  { lo: 'ປານີ ອິນທະວົງ', en: 'Pany Inthavong', g: 'female' },
  { lo: 'ສີສະຫວາດ ຈັນທະສອນ', en: 'Sisavath Chanthasone', g: 'male' },
  { lo: 'ບົວພັນ ແກ້ວວົງສາ', en: 'Bouaphanh Keovongsa', g: 'female' },
  { lo: 'ໄກຄຳ ພົມວິໄລ', en: 'Kaykham Phomvilay', g: 'male' },
  { lo: 'ເພັດສະໝອນ ສຸລິວົງ', en: 'Phetsamone Soulivong', g: 'female' },
  { lo: 'ອຳພອນ ໄຊຍະວົງ', en: 'Amphone Xayavong', g: 'male' },
  { lo: 'ລັດດາ ບຸບຜາ', en: 'Ladda Boupha', g: 'female' },
  { lo: 'ຈັນສະໝອນ ໄຊສົມບັດ', en: 'Chansamone Xaysombath', g: 'male' },
];

// Families: several children share a parent so the parent portal shows a child switcher.
const PARENTS: { lo: string; en: string; rel: 'father' | 'mother' | 'guardian' | 'grandparent'; job: string; children: number[] }[] = [
  { lo: 'ສົມພອນ ພົມມະວົງ', en: 'Somphone Phommavong', rel: 'father', job: 'Engineer, Électricité du Laos', children: [0, 7, 13] },
  { lo: 'ດາວອນ ແກ້ວມະນີ', en: 'Davone Keomany', rel: 'mother', job: 'Nurse, Mahosot Hospital', children: [1, 3] },
  { lo: 'ຄຳຫຼ້າ ຈິດປະເສີດ', en: 'Khamla Chitprasert', rel: 'father', job: 'Shop owner', children: [2] },
  { lo: 'ບົວໄລ ວົງໄຊ', en: 'Bouaphay Vongxay', rel: 'mother', job: 'Teacher', children: [4] },
  { lo: 'ສີພອນ ສີສຸພັນ', en: 'Siphone Sisouphanh', rel: 'mother', job: 'Accountant', children: [5] },
  { lo: 'ວົງສະຫວັນ ຈັນທະລາ', en: 'Vongsavanh Chanthala', rel: 'father', job: 'Civil servant, Ministry of Health', children: [6] },
  { lo: 'ເກດສະໜາ ສີຫາລາດ', en: 'Ketsana Sihalath', rel: 'father', job: 'Banker, BCEL', children: [8] },
  { lo: 'ດາວອນ ຈັນທະວົງ', en: 'Davone Chanthavong', rel: 'mother', job: 'Pharmacist', children: [9] },
  { lo: 'ນ້ອຍ ເທບວົງສາ', en: 'Noy Thepvongsa', rel: 'mother', job: 'Market vendor', children: [10, 22] },
  { lo: 'ວັນນະລີ ວໍລະຈິດ', en: 'Vannaly Vorachit', rel: 'mother', job: 'Tour guide', children: [11] },
  { lo: 'ສົມບັດ ພອນໄຊ', en: 'Sombath Phonxay', rel: 'father', job: 'Driver', children: [12] },
  { lo: 'ບຸນທັນ ດວງດາລາ', en: 'Bounthanh Douangdara', rel: 'grandparent', job: 'Retired', children: [14] },
  { lo: 'ພອນສະຫວັນ ສີສຸລາດ', en: 'Phonsavanh Sisoulath', rel: 'father', job: 'Police officer', children: [15] },
  { lo: 'ມະນີລາ ລັດຕະນະ', en: 'Manila Rattana', rel: 'mother', job: 'Designer', children: [16] },
  { lo: 'ທອງສຸກ ແສງຈັນ', en: 'Thongsouk Sengchanh Sr.', rel: 'father', job: 'Senior engineer, EDL', children: [17, 18] },
  { lo: 'ຄຳແພງ ສຸວັນນະສານ', en: 'Khamphaeng Souvannasane', rel: 'mother', job: 'Lawyer', children: [19] },
  { lo: 'ສຸລິຍົງ ວົງສາ', en: 'Souliyong Vongsa', rel: 'guardian', job: 'Farmer', children: [20] },
  { lo: 'ບຸນເຫຼືອ ພົມມະຈັນ', en: 'Bounleua Phommachanh', rel: 'father', job: 'Mechanic', children: [21] },
  { lo: 'ແສງດາວ ສີວົງໄຊ', en: 'Sengdao Sivongxay', rel: 'mother', job: 'Restaurant owner', children: [23, 27] },
  { lo: 'ສົມຈິດ ອິນທະວົງ', en: 'Somchit Inthavong', rel: 'father', job: 'IT officer', children: [24] },
  { lo: 'ຈັນທາ ຈັນທະສອນ', en: 'Chantha Chanthasone', rel: 'mother', job: 'Doctor', children: [25] },
  { lo: 'ແກ້ວ ແກ້ວວົງສາ', en: 'Keo Keovongsa', rel: 'father', job: 'Carpenter', children: [26] },
  { lo: 'ນາລີ ສຸລິວົງ', en: 'Naly Soulivong', rel: 'mother', job: 'Seamstress', children: [28] },
  { lo: 'ສຸກສົມບູນ ໄຊຍະວົງ', en: 'Souksomboun Xayavong', rel: 'father', job: 'Businessman', children: [29] },
  { lo: 'ພອນປະເສີດ ບຸບຜາ', en: 'Phonprasert Boupha', rel: 'father', job: 'Soldier', children: [30] },
  { lo: 'ບົວສອນ ໄຊສົມບັດ', en: 'Bouasone Xaysombath', rel: 'mother', job: 'Hotel manager', children: [31] },
];

const CLASSES = [
  { lo: 'ມ.5/1', en: 'M5/1', levelLo: 'ມັດທະຍົມ 5', levelEn: 'Grade 10', homeroom: 't1', room: '201' },
  { lo: 'ມ.5/2', en: 'M5/2', levelLo: 'ມັດທະຍົມ 5', levelEn: 'Grade 10', homeroom: 't2', room: '202' },
  { lo: 'ມ.6/1', en: 'M6/1', levelLo: 'ມັດທະຍົມ 6', levelEn: 'Grade 11', homeroom: 't4', room: '301' },
  { lo: 'ມ.7/1', en: 'M7/1', levelLo: 'ມັດທະຍົມ 7', levelEn: 'Grade 12', homeroom: 't5', room: '302' },
] as const;

const SUBJECTS = [
  { code: 'MATH', lo: 'ຄະນິດສາດ', en: 'Mathematics', credits: 3, teacher: 't1', perWeek: 5, room: null },
  { code: 'LAO', lo: 'ພາສາລາວ ແລະ ວັນນະຄະດີ', en: 'Lao Language & Literature', credits: 2, teacher: 't2', perWeek: 4, room: null },
  { code: 'ENG', lo: 'ພາສາອັງກິດ', en: 'English', credits: 2, teacher: 't3', perWeek: 4, room: null },
  { code: 'PHY', lo: 'ຟີຊິກສາດ', en: 'Physics', credits: 2, teacher: 't4', perWeek: 3, room: 'Lab 1' },
  { code: 'CHEM', lo: 'ເຄມີສາດ', en: 'Chemistry', credits: 2, teacher: 't5', perWeek: 3, room: 'Lab 2' },
  { code: 'BIO', lo: 'ຊີວະວິທະຍາ', en: 'Biology', credits: 2, teacher: 't5', perWeek: 2, room: 'Lab 2' },
  { code: 'HIS', lo: 'ປະຫວັດສາດ', en: 'History', credits: 1, teacher: 't6', perWeek: 2, room: null },
  { code: 'IT', lo: 'ເຕັກໂນໂລຊີຂໍ້ມູນຂ່າວສານ', en: 'Information Technology', credits: 1, teacher: 't6', perWeek: 2, room: 'Computer Lab' },
] as const;

const PERIODS = [
  ['08:00', '08:50'], ['08:55', '09:45'], ['10:05', '10:55'], ['11:00', '11:50'], ['13:00', '13:50'],
] as const;

const SHOPS = [
  { lo: 'ຮ້ານອາຫານຕາມສັ່ງ 1', en: 'Canteen Stall 1 – Rice & Curries', locLo: 'ໂຮງອາຫານ ຊັ້ນ 1', locEn: 'Canteen, ground floor', items: [15000, 20000, 25000], descEn: 'Rice, curries and daily set meals', descLo: 'ເຂົ້າ, ແກງ ແລະ ອາຫານຊຸດປະຈຳວັນ' },
  { lo: 'ຮ້ານເຝີ ແລະ ເຂົ້າປຽກ', en: 'Canteen Stall 2 – Noodles', locLo: 'ໂຮງອາຫານ ຊັ້ນ 1', locEn: 'Canteen, ground floor', items: [20000, 25000], descEn: 'Pho, khao piak and noodle soups', descLo: 'ເຝີ, ເຂົ້າປຽກ ແລະ ເສັ້ນນ້ຳ' },
  { lo: 'ຮ້ານເຄື່ອງດື່ມ ແລະ ໜົມ', en: 'Canteen Stall 3 – Drinks & Snacks', locLo: 'ໂຮງອາຫານ ຊັ້ນ 1', locEn: 'Canteen, ground floor', items: [5000, 8000, 10000, 12000], descEn: 'Drinks, fruit and snacks', descLo: 'ເຄື່ອງດື່ມ, ໝາກໄມ້ ແລະ ໜົມ' },
  { lo: 'ຮ້ານເຄື່ອງຂຽນ ແລະ ປຶ້ມ', en: 'Stationery & Bookstore', locLo: 'ອາຄານບໍລິຫານ ຊັ້ນ 1', locEn: 'Admin building, floor 1', items: [8000, 15000, 30000, 45000], descEn: 'Notebooks, pens and textbooks', descLo: 'ປຶ້ມຂຽນ, ບິກ ແລະ ປຶ້ມແບບຮຽນ' },
  { lo: 'ຮ້ານເບເກີຣີ', en: 'Campus Bakery', locLo: 'ຂ້າງຫໍສະໝຸດ', locEn: 'Next to the library', items: [8000, 12000, 15000], descEn: 'Bread, pastries and cakes', descLo: 'ເຂົ້າຈີ່, ເຂົ້າໜົມອົບ ແລະ ເຄັກ' },
] as const;

const ANNOUNCEMENTS: { audience: 'all' | 'parents' | 'teachers' | 'class'; days: number; expires: number; forClass: number | null; en: string; lo: string; cEn: string; cLo: string }[] = [
  { audience: 'all' as const, days: -2, expires: 20, forClass: null,
    en: 'School closed for Boun Souang Heua (Boat Racing Festival)', lo: 'ປະກາດພັກຮຽນ ເນື່ອງໃນບຸນຊ່ວງເຮືອ',
    cEn: 'The school will be closed on the day of the Vientiane boat racing festival. Classes resume the following morning at 08:00.',
    cLo: 'ໂຮງຮຽນຈະປິດການຮຽນການສອນໃນວັນບຸນຊ່ວງເຮືອນະຄອນຫຼວງວຽງຈັນ ແລະ ເປີດຮຽນຕາມປົກກະຕິໃນຕອນເຊົ້າວັນຖັດໄປ ເວລາ 08:00.' },
  { audience: 'parents' as const, days: -1, expires: 14, forClass: null,
    en: 'Term 1 parent–teacher meeting', lo: 'ກອງປະຊຸມຜູ້ປົກຄອງ ພາກຮຽນ 1',
    cEn: 'Parents are invited to meet homeroom teachers in each classroom on Saturday at 09:00 to review first-month results.',
    cLo: 'ຂໍເຊີນຜູ້ປົກຄອງເຂົ້າຮ່ວມກອງປະຊຸມກັບຄູປະຈຳຫ້ອງ ໃນວັນເສົາ ເວລາ 09:00 ເພື່ອທົບທວນຜົນການຮຽນເດືອນທຳອິດ.' },
  { audience: 'teachers' as const, days: 0, expires: 7, forClass: null,
    en: 'Submit monthly test scores by the end of the month', lo: 'ກຳນົດສົ່ງຄະແນນສອບເສັງປະຈຳເດືອນ',
    cEn: 'Please enter and publish all monthly test scores in the gradebook before the last school day of the month.',
    cLo: 'ຂໍໃຫ້ຄູທຸກທ່ານບັນທຶກ ແລະ ເຜີຍແຜ່ຄະແນນສອບເສັງປະຈຳເດືອນໃນລະບົບ ກ່ອນວັນຮຽນສຸດທ້າຍຂອງເດືອນ.' },
  { audience: 'class' as const, days: -3, expires: 30, forClass: 3,
    en: 'M7/1 extra revision classes for the national exam', lo: 'ຫ້ອງ ມ.7/1 ຮຽນເສີມກຽມສອບເສັງຈົບຊັ້ນ',
    cEn: 'Extra Mathematics and Physics revision runs every Wednesday from 14:00 to 15:30 in room 302.',
    cLo: 'ຮຽນເສີມວິຊາຄະນິດສາດ ແລະ ຟີຊິກສາດ ທຸກວັນພຸດ ເວລາ 14:00–15:30 ທີ່ຫ້ອງ 302.' },
];

// Fee types and what each grade pays this year (kip). Books are the same for everyone.
const FEE_TYPES = [
  { key: 'tuition', en: 'Tuition', lo: 'ຄ່າຮຽນ', descEn: 'Term tuition fee', descLo: 'ຄ່າຮຽນປະຈຳພາກຮຽນ' },
  { key: 'books', en: 'Books & materials', lo: 'ຄ່າປຶ້ມ ແລະ ອຸປະກອນ', descEn: 'Textbooks and workbooks for the year', descLo: 'ປຶ້ມແບບຮຽນ ແລະ ປຶ້ມແບບຝຶກຫັດຕະຫຼອດປີ' },
  { key: 'uniform', en: 'Uniform', lo: 'ຄ່າເຄື່ອງແບບ', descEn: 'Two sets of school uniform', descLo: 'ເຄື່ອງແບບນັກຮຽນ 2 ຊຸດ' },
] as const;
const TUITION_BY_CLASS = [1_500_000, 1_500_000, 1_650_000, 1_800_000];

// A staff role for the admin portal with only what a bursar needs.
const BURSAR_PERMISSIONS = [
  'dashboard.view', 'reports.view', 'students.view', 'finance.view', 'finance.topups_approve', 'finance.wallets_manage',
  'fees.view', 'fees.manage', 'fees.collect',
];

const GATES = {
  main: { en: 'Gate 1 – Main Entrance', lo: 'ປະຕູ 1 – ທາງເຂົ້າຫຼັກ' },
  west: { en: 'Gate 2 – Canteen Side', lo: 'ປະຕູ 2 – ຂ້າງໂຮງອາຫານ' },
};

// ─────────────────────────────────────────────────────────────────────────
async function demoIds() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: DEMO_DOMAIN } }, select: { userId: true } });
  const students = await prisma.student.findMany({ where: { studentCode: { startsWith: STUDENT_PREFIX } }, select: { studentId: true } });
  const subjects = await prisma.subject.findMany({ where: { subjectCode: { startsWith: SUBJECT_PREFIX } }, select: { subjectId: true } });
  const userIds = users.map((u) => u.userId);
  const classes = await prisma.class.findMany({ where: { homeroomTeacherId: { in: userIds } }, select: { classId: true } });
  return {
    userIds,
    studentIds: students.map((s) => s.studentId),
    subjectIds: subjects.map((s) => s.subjectId),
    classIds: classes.map((c) => c.classId),
  };
}

async function reset() {
  const { userIds, studentIds, subjectIds, classIds } = await demoIds();
  const wallets = await prisma.walletAccount.findMany({ where: { studentId: { in: studentIds } }, select: { walletId: true } });
  const walletIds = wallets.map((w) => w.walletId);
  const classSubjects = await prisma.classSubject.findMany({
    where: { OR: [{ classId: { in: classIds } }, { subjectId: { in: subjectIds } }] }, select: { id: true, termId: true },
  });
  const csIds = classSubjects.map((c) => c.id);

  // Children before parents; Restrict relations first.
  await prisma.invoice.deleteMany({ where: { studentId: { in: studentIds } } }); // cascades payments
  await prisma.feeStructure.deleteMany({ where: { OR: [{ classId: { in: classIds } }, { createdBy: { in: userIds } }] } });
  await prisma.feeType.deleteMany({ where: { nameEn: { in: FEE_TYPES.map((f) => f.en) }, structures: { none: {} } } });
  await prisma.grade.deleteMany({ where: { OR: [{ studentId: { in: studentIds } }, { classSubjectId: { in: csIds } }] } });
  await prisma.schedule.deleteMany({ where: { classSubjectId: { in: csIds } } });
  await prisma.classSubject.deleteMany({ where: { id: { in: csIds } } });
  await prisma.topUpRequest.deleteMany({ where: { OR: [{ studentId: { in: studentIds } }, { parentUserId: { in: userIds } }] } });
  await prisma.walletTransaction.deleteMany({ where: { walletId: { in: walletIds } } });
  await prisma.leaveRequest.deleteMany({ where: { OR: [{ studentId: { in: studentIds } }, { parentUserId: { in: userIds } }] } });
  await prisma.spendingLimit.deleteMany({ where: { OR: [{ studentId: { in: studentIds } }, { setBy: { in: userIds } }] } });
  await prisma.announcement.deleteMany({ where: { OR: [{ createdBy: { in: userIds } }, { classId: { in: classIds } }, { titleEn: { in: ANNOUNCEMENTS.map((a) => a.en) } }] } });
  await prisma.student.deleteMany({ where: { studentId: { in: studentIds } } }); // cascades cards, logs, attendance, wallets, links
  await prisma.class.deleteMany({ where: { classId: { in: classIds } } });
  await prisma.subject.deleteMany({ where: { subjectId: { in: subjectIds } } });
  // Demo shops only when no real wallet ever bought there. Academic terms are kept: they may be real.
  await prisma.shop.deleteMany({ where: { shopNameEn: { in: SHOPS.map((x) => x.en) }, transactions: { none: {} } } });
  await prisma.teacher.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.parent.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.role.deleteMany({ where: { code: 'bursar', isSystem: false, users: { none: {} } } });
  console.log(`Removed demo data: ${userIds.length} users, ${studentIds.length} students.`);
}

// ─────────────────────────────────────────────────────────────────────────
async function main() {
  if (process.argv.includes('--reset')) await reset();

  const existing = await prisma.user.count({ where: { email: { endsWith: DEMO_DOMAIN } } });
  if (existing) {
    console.log('Demo data already present — run with --reset to rebuild it.');
    return;
  }

  const roles = Object.fromEntries((await prisma.role.findMany()).map((r) => [r.code, r.roleId]));
  const admin = await prisma.user.findFirst({ where: { roleId: roles.admin }, orderBy: { userId: 'asc' } });
  if (!roles.teacher || !roles.parent || !admin) throw new Error('Run the base seed first (roles + admin).');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const gradeTypes = await prisma.gradeType.findMany();

  // ── Academic year & terms ──
  const year = academicYearForDate(NOW);
  const [y1, y2] = year.split('-').map(Number);
  // Terms are reused when the school already created them (they are never deleted by --reset).
  const hasActive = await prisma.academicTerm.count({ where: { status: 'active' } });
  const term1 = (await prisma.academicTerm.findFirst({ where: { academicYear: year, termNameEn: 'Term 1' } }))
    ?? await prisma.academicTerm.create({ data: {
      academicYear: year, termNameEn: 'Term 1', termNameLo: 'ພາກຮຽນ 1',
      startDate: new Date(`${y1}-09-01T00:00:00Z`), endDate: new Date(`${y2}-01-31T00:00:00Z`),
      status: hasActive ? 'upcoming' : 'active',
    } });
  if (!(await prisma.academicTerm.findFirst({ where: { academicYear: year, termNameEn: 'Term 2' } }))) {
    await prisma.academicTerm.create({ data: {
      academicYear: year, termNameEn: 'Term 2', termNameLo: 'ພາກຮຽນ 2',
      startDate: new Date(`${y2}-02-01T00:00:00Z`), endDate: new Date(`${y2}-06-30T00:00:00Z`), status: 'upcoming',
    } });
  }

  // ── Teachers ──
  const teacherId: Record<string, number> = {};
  for (const [i, t] of TEACHERS.entries()) {
    const u = await prisma.user.create({ data: {
      fullNameLo: t.lo, fullNameEn: t.en, email: `teacher${i + 1}${DEMO_DOMAIN}`,
      phoneNumber: `+856 20 5550 ${String(100 + i).padStart(4, '0')}`, passwordHash, roleId: roles.teacher,
      langPref: t.key === 't3' ? 'en' : 'lo',
      teacher: { create: { employeeCode: `DEMO-T${String(i + 1).padStart(3, '0')}`, specialization: t.spec, qualification: t.qual, hireDate: new Date(`${2015 + i}-08-15T00:00:00Z`) } },
    } });
    teacherId[t.key] = u.userId;
  }

  // ── Classes, subjects, class subjects ──
  const classIds: number[] = [];
  for (const c of CLASSES) {
    const cls = await prisma.class.create({ data: {
      classNameLo: c.lo, classNameEn: c.en, gradeLevelLo: c.levelLo, gradeLevelEn: c.levelEn,
      academicYear: year, homeroomTeacherId: teacherId[c.homeroom],
    } });
    classIds.push(cls.classId);
  }
  const subjectIds: Record<string, number> = {};
  for (const s of SUBJECTS) {
    const sub = await prisma.subject.create({ data: {
      subjectCode: `${SUBJECT_PREFIX}${s.code}`, subjectNameLo: s.lo, subjectNameEn: s.en, credits: s.credits,
    } });
    subjectIds[s.code] = sub.subjectId;
  }
  const classSubject: Record<string, number> = {}; // `${classIdx}:${code}` → id
  for (const [ci, classId] of classIds.entries()) {
    for (const s of SUBJECTS) {
      const cs = await prisma.classSubject.create({ data: { classId, subjectId: subjectIds[s.code], teacherId: teacherId[s.teacher], termId: term1.termId } });
      classSubject[`${ci}:${s.code}`] = cs.id;
    }
  }

  // ── Timetable: randomised greedy, retried until no teacher is double-booked ──
  const buildTimetable = (): Prisma.ScheduleCreateManyInput[] | null => {
    const busy = new Set<string>(); // `${teacher}:${day}:${period}`
    const rows: Prisma.ScheduleCreateManyInput[] = [];
    for (const [ci, c] of CLASSES.entries()) {
      const remaining: Record<string, number> = Object.fromEntries(SUBJECTS.map((s) => [s.code, s.perWeek]));
      for (let day = 1; day <= 5; day++) {
        const usedToday = new Set<string>();
        for (let p = 0; p < PERIODS.length; p++) {
          const options = SUBJECTS
            .filter((s) => remaining[s.code] > 0 && !busy.has(`${s.teacher}:${day}:${p}`))
            .map((s) => ({ s, r: rand() }))
            .sort((a, b) => (Number(usedToday.has(a.s.code)) - Number(usedToday.has(b.s.code))) || (remaining[b.s.code] - remaining[a.s.code]) || (a.r - b.r));
          const s = options[0]?.s;
          if (!s) return null; // dead end: start over
          remaining[s.code]--; usedToday.add(s.code); busy.add(`${s.teacher}:${day}:${p}`);
          rows.push({
            classSubjectId: classSubject[`${ci}:${s.code}`], dayOfWeek: day,
            startTime: toTime(PERIODS[p][0]), endTime: toTime(PERIODS[p][1]), roomNumber: s.room ?? c.room,
          });
        }
      }
    }
    return rows;
  };
  let scheduleRows: Prisma.ScheduleCreateManyInput[] | null = null;
  for (let attempt = 0; attempt < 500 && !scheduleRows; attempt++) scheduleRows = buildTimetable();
  if (!scheduleRows) throw new Error('Could not build a conflict-free timetable');
  await prisma.schedule.createMany({ data: scheduleRows });

  // ── Shops ──
  const shopIds: number[] = [];
  for (const s of SHOPS) {
    const shop = await prisma.shop.create({ data: { shopNameLo: s.lo, shopNameEn: s.en, locationLo: s.locLo, locationEn: s.locEn, descriptionEn: s.descEn, descriptionLo: s.descLo } });
    shopIds.push(shop.shopId);
  }

  // ── Students, cards, class enrolment ──
  const students: { id: number; cardId: number; cardUid: string; classIdx: number; homeroom: number }[] = [];
  const provinces = [
    { village: 'ບ້ານໂພນປ່າເປົ້າ', district: 'ເມືອງສີສັດຕະນາກ', province: 'ນະຄອນຫຼວງວຽງຈັນ' },
    { village: 'ບ້ານຊຽງຢືນ', district: 'ເມືອງຈັນທະບູລີ', province: 'ນະຄອນຫຼວງວຽງຈັນ' },
    { village: 'ບ້ານດົງປ່າລານ', district: 'ເມືອງສີສັດຕະນາກ', province: 'ນະຄອນຫຼວງວຽງຈັນ' },
    { village: 'ບ້ານໂນນສະຫວ່າງ', district: 'ເມືອງໄຊເສດຖາ', province: 'ນະຄອນຫຼວງວຽງຈັນ' },
    { village: 'ບ້ານໂພນຕ້ອງ', district: 'ເມືອງຈັນທະບູລີ', province: 'ນະຄອນຫຼວງວຽງຈັນ' },
  ];
  for (const [i, s] of STUDENTS.entries()) {
    const classIdx = Math.floor(i / 8);
    const birthYear = y1 - 16 - Math.max(0, classIdx - 1); // ມ.5 ≈ 16 years old
    const addr = provinces[i % provinces.length];
    const uid = Array.from({ length: 4 }, () => randInt(0, 255).toString(16).padStart(2, '0').toUpperCase()).join(':');
    const student = await prisma.student.create({ data: {
      studentCode: `${STUDENT_PREFIX}${year.slice(0, 4)}-${String(i + 1).padStart(3, '0')}`,
      fullNameLo: s.lo, fullNameEn: s.en, gender: s.g,
      dateOfBirth: new Date(`${birthYear}-${String(randInt(1, 12)).padStart(2, '0')}-${String(randInt(1, 28)).padStart(2, '0')}T00:00:00Z`),
      ...addr, bloodType: pick(['A+', 'B+', 'O+', 'AB+', 'O-']),
      medicalNotes: i === 9 ? 'ແພ້ຖົ່ວດິນ (Peanut allergy)' : i === 20 ? 'ຈຳກັດນ້ຳຕານ (Sugar-restricted diet)' : null,
      classStudents: { create: { classId: classIds[classIdx], enrolledAt: new Date(`${y1}-09-01T01:00:00Z`) } },
      cards: { create: {
        cardUid: uid, issuedBy: admin.userId, issuedDate: new Date(`${y1}-09-01T02:00:00Z`),
        expiredDate: new Date(`${y2}-08-31T00:00:00Z`), status: 'active',
      } },
    }, include: { cards: true } });
    students.push({ id: student.studentId, cardId: student.cards[0].cardId, cardUid: uid, classIdx, homeroom: teacherId[CLASSES[classIdx].homeroom] });
  }
  // One lost card, replaced by a new active one (history stays visible on the Cards page).
  {
    const s = students[12];
    await prisma.card.update({ where: { cardId: s.cardId }, data: { status: 'lost', notes: 'ຜູ້ປົກຄອງແຈ້ງບັດເສຍ' } });
    const replacement = await prisma.card.create({ data: { cardUid: '3C:11:7F:AA', studentId: s.id, issuedBy: admin.userId, issuedDate: addDays(TODAY, -3), expiredDate: new Date(`${y2}-08-31T00:00:00Z`) } });
    s.cardId = replacement.cardId; s.cardUid = replacement.cardUid;
  }

  // ── Parents ──
  const parentOf: number[] = []; // student index → parent user id
  for (const [i, p] of PARENTS.entries()) {
    const u = await prisma.user.create({ data: {
      fullNameLo: p.lo, fullNameEn: p.en, email: `parent${i + 1}${DEMO_DOMAIN}`,
      phoneNumber: `+856 20 5551 ${String(1000 + i).padStart(4, '0')}`, passwordHash, roleId: roles.parent,
      parent: { create: { occupation: p.job, address: 'Vientiane Capital', emergencyContact: `+856 20 5552 ${String(1000 + i).padStart(4, '0')}` } },
    } });
    for (const idx of p.children) {
      parentOf[idx] = u.userId;
      await prisma.parentStudent.create({ data: { parentUserId: u.userId, studentId: students[idx].id, relationship: p.rel, isPrimaryContact: true } });
    }
  }

  // ── Spending limits & blocked shops ──
  const limits: Record<number, { daily: number; perTx: number }> = {};
  for (const [i, s] of students.entries()) {
    if (i % 3 !== 0 && i !== 9 && i !== 20) continue;
    const daily = pick([50000, 70000, 100000]);
    const perTx = daily >= 70000 ? 30000 : 25000;
    limits[i] = { daily, perTx };
    await prisma.spendingLimit.create({ data: {
      studentId: s.id, dailyMax: daily, perTransactionMax: perTx, alertThreshold: 30000, setBy: parentOf[i],
      notes: i === 9 ? 'ແພ້ຖົ່ວດິນ – ຫ້າມຊື້ເບເກີຣີ' : i === 20 ? 'ຈຳກັດເຄື່ອງດື່ມຫວານ' : null,
    } });
  }
  const blocked: Record<number, Set<number>> = { 9: new Set([shopIds[4]]), 20: new Set([shopIds[2]]) };
  for (const [idx, shops] of Object.entries(blocked)) {
    for (const shopId of shops) await prisma.blockedShop.create({ data: { studentId: students[Number(idx)].id, shopId } });
  }

  // ── School days in the last six weeks (up to today) ──
  const schoolDays: Date[] = [];
  for (let d = -41; d <= 0; d++) {
    const day = addDays(TODAY, d);
    if (isSchoolDay(day) && schoolDateValue(day) >= term1.startDate) schoolDays.push(day);
  }
  const today = TODAY;
  const isToday = (day: Date) => day.getTime() === today.getTime();

  // ── Leave requests (approved ones excuse attendance) ──
  type Leave = { idx: number; from: number; to: number; status: 'pending' | 'approved' | 'rejected'; reason: string; requested: number };
  const leaves: Leave[] = [
    { idx: 0, from: 1, to: 2, status: 'pending', reason: 'ເປັນໄຂ້ຫວັດໃຫຍ່ ທ່ານໝໍແນະນຳໃຫ້ພັກຜ່ອນ 2 ວັນ', requested: 0 },
    { idx: 17, from: 1, to: 1, status: 'pending', reason: 'ຕິດຕາມຄອບຄົວໄປງານບຸນທີ່ຫຼວງພະບາງ', requested: 0 },
    { idx: 26, from: 4, to: 6, status: 'pending', reason: 'ນັດກວດສຸຂະພາບຢູ່ໂຮງໝໍມິດຕະພາບ', requested: -1 },
    { idx: 5, from: -9, to: -8, status: 'approved', reason: 'ປວດທ້ອງ ແລະ ມີໄຂ້', requested: -10 },
    { idx: 14, from: -4, to: -4, status: 'approved', reason: 'ງານແຕ່ງດອງຂອງອ້າຍ', requested: -6 },
    { idx: 29, from: -2, to: -1, status: 'approved', reason: 'ເຈັບແຂ້ວ ຕ້ອງໄປຄລີນິກ', requested: -3 },
    { idx: 22, from: -7, to: -7, status: 'rejected', reason: 'ໄປທ່ຽວກັບຄອບຄົວ', requested: -8 },
  ];
  const excused = new Set<string>(); // `${idx}:${ymd}`
  for (const l of leaves) {
    const start = addDays(TODAY, l.from), end = addDays(TODAY, l.to);
    const requestedAt = at(addDays(TODAY, l.requested), 19, randInt(0, 59));
    await prisma.leaveRequest.create({ data: {
      studentId: students[l.idx].id, parentUserId: parentOf[l.idx], startDate: schoolDateValue(start), endDate: schoolDateValue(end),
      reason: l.reason, status: l.status, requestedAt,
      approvedBy: l.status === 'pending' ? null : students[l.idx].homeroom,
      processedAt: l.status === 'pending' ? null : at(addDays(TODAY, l.requested + 1), 8, 30),
    } });
    if (l.status === 'approved') {
      for (let d = start; d <= end; d = addDays(d, 1)) excused.add(`${l.idx}:${schoolDateString(d)}`);
    }
  }

  // ── Attendance: gate taps + daily status ──
  const logs: Prisma.AttendanceLogCreateManyInput[] = [];
  const daily: Prisma.DailyAttendanceCreateManyInput[] = [];
  const notifications: Prisma.NotificationCreateManyInput[] = [];
  const presentOn = new Map<string, boolean>(); // for wallet purchases
  for (const day of schoolDays) {
    const ymd = schoolDateString(day);
    for (const [i, s] of students.entries()) {
      const key = `${i}:${ymd}`;
      if (excused.has(key)) {
        daily.push({ studentId: s.id, date: schoolDateValue(day), status: 'excused', source: 'leave', recordedBy: s.homeroom });
        continue;
      }
      const roll = rand();
      if (roll < 0.04) {
        daily.push({ studentId: s.id, date: schoolDateValue(day), status: 'absent', source: 'teacher', recordedBy: s.homeroom });
        continue;
      }
      const late = roll < 0.11;
      const forgotCard = !late && roll < 0.125;
      const checkIn = late ? at(day, 7, randInt(31, 59), randInt(0, 59)) : at(day, 6, randInt(40, 59), randInt(0, 59));
      const checkInFinal = !late && rand() < 0.5 ? at(day, 7, randInt(0, 28), randInt(0, 59)) : checkIn;
      if (checkInFinal > NOW) continue; // not arrived yet today
      const gate = rand() < 0.8 ? GATES.main : GATES.west;
      logs.push({
        studentId: s.id, cardId: forgotCard ? null : s.cardId, logType: 'check_in', logTime: checkInFinal,
        gateLocationEn: gate.en, gateLocationLo: gate.lo, isManualEntry: forgotCard, manualEntryBy: forgotCard ? s.homeroom : null,
        notified: true, remark: forgotCard ? 'ລືມບັດ – ຄູບັນທຶກແທນ' : null,
      });
      daily.push({
        studentId: s.id, date: schoolDateValue(day), status: late ? 'late' : 'present',
        source: forgotCard ? 'teacher' : 'card', firstCheckIn: checkInFinal, recordedBy: forgotCard ? s.homeroom : null,
      });
      presentOn.set(key, true);
      const checkOut = at(day, 16, randInt(0, 45), randInt(0, 59));
      if (checkOut <= NOW) {
        logs.push({ studentId: s.id, cardId: s.cardId, logType: 'check_out', logTime: checkOut, gateLocationEn: GATES.main.en, gateLocationLo: GATES.main.lo, notified: true });
      }
      if (isToday(day)) {
        const hhmm = new Date(checkInFinal.getTime() + 7 * 3600 * 1000).toISOString().slice(11, 16);
        notifications.push({
          recipientUserId: parentOf[i], studentId: s.id, type: 'check_in', channel: 'app_push', status: 'sent',
          messageLo: `${STUDENTS[i].lo} ເຂົ້າໂຮງຮຽນເວລາ ${hhmm} (${gate.lo})`,
          messageEn: `${STUDENTS[i].en} arrived at school at ${hhmm} (${gate.en})`,
          sentAt: new Date(checkInFinal.getTime() + 2000), deliveredAt: new Date(checkInFinal.getTime() + 5000),
        });
      }
    }
  }
  await prisma.attendanceLog.createMany({ data: logs });
  await prisma.dailyAttendance.createMany({ data: daily });
  await prisma.notification.createMany({ data: notifications });

  // ── Wallets: approved top-ups, canteen purchases, pending/rejected requests ──
  let refCounter = 1;
  const ref = (prefix: string) => `DEMO-${prefix}-${String(refCounter++).padStart(5, '0')}`;
  const bcelLabel = { en: 'BCEL One transfer', lo: 'ໂອນຜ່ານ BCEL One' };
  for (const [i, s] of students.entries()) {
    const wallet = await prisma.walletAccount.create({ data: { studentId: s.id, balance: 0 } });
    let balance = 0;
    let lastTxAt = new Date(0); // keeps the ledger in time order
    // `requestedAt` is when the parent asked; the bursar approves it `approveAfterMin` later.
    const topUp = async (requestedAt: Date, amount: number, method: 'mobile_banking' | 'cash', approveAfterMin = 20) => {
      const approvedAt = new Date(Math.max(requestedAt.getTime() + approveAfterMin * 60 * 1000, lastTxAt.getTime() + 60 * 1000));
      const tx = await prisma.walletTransaction.create({ data: {
        walletId: wallet.walletId, transactionType: 'top_up', amount, balanceBefore: balance, balanceAfter: balance + amount,
        descriptionEn: 'Top-up approved', descriptionLo: 'ອະນຸມັດການເຕີມເງິນ', referenceNo: ref('TU'), processedBy: admin.userId,
        createdAt: approvedAt,
      } });
      await prisma.topUpRequest.create({ data: {
        studentId: s.id, parentUserId: parentOf[i], amount, method,
        methodLabelEn: method === 'cash' ? 'Cash at bursar desk' : bcelLabel.en, methodLabelLo: method === 'cash' ? 'ເງິນສົດທີ່ຫ້ອງການເງິນ' : bcelLabel.lo,
        status: 'approved', approvedBy: admin.userId, requestedAt, processedAt: approvedAt, transactionId: tx.transactionId,
      } });
      balance += amount;
      lastTxAt = approvedAt;
    };

    await topUp(at(addDays(schoolDays[0], -1), 19, randInt(0, 59)), pick([150000, 200000, 300000]), rand() < 0.75 ? 'mobile_banking' : 'cash');
    const purchases: Prisma.WalletTransactionCreateManyInput[] = [];
    for (const day of schoolDays) {
      if (!presentOn.get(`${i}:${schoolDateString(day)}`)) continue;
      let spentToday = 0;
      const moments = [at(day, 9, randInt(46, 59)), at(day, 11, randInt(51, 59)), at(day, 12, randInt(0, 30))].filter(() => rand() < 0.55);
      for (const when of moments) {
        if (when > NOW) continue;
        const choices = shopIds.map((id, k) => ({ id, k })).filter(({ id }) => !blocked[i]?.has(id));
        const { id: shopId, k } = pick(choices);
        let price: number = pick(SHOPS[k].items);
        const lim = limits[i];
        if (lim && (price > lim.perTx || spentToday + price > lim.daily)) continue;
        if (balance < price) {
          // Low balance: the parent tops up via BCEL One — the evening before if the
          // student has not bought anything yet today, otherwise during the morning.
          const requested = spentToday === 0 ? at(addDays(day, -1), 20, randInt(0, 50)) : new Date(lastTxAt.getTime() + 5 * 60 * 1000);
          await topUp(requested, pick([100000, 150000, 200000]), 'mobile_banking', spentToday === 0 ? 20 : 3);
          if (lastTxAt >= when) continue; // approval would land after this purchase; skip it
        }
        price = roundTo(price, 1000);
        purchases.push({
          walletId: wallet.walletId, shopId, transactionType: 'purchase', amount: price, balanceBefore: balance, balanceAfter: balance - price,
          descriptionEn: SHOPS[k].en, descriptionLo: SHOPS[k].lo, referenceNo: ref('POS'), createdAt: when,
        });
        balance -= price; spentToday += price; lastTxAt = when;
      }
    }
    if (purchases.length) await prisma.walletTransaction.createMany({ data: purchases });
    await prisma.walletAccount.update({ where: { walletId: wallet.walletId }, data: { balance, status: i === 12 ? 'frozen' : 'active', notes: i === 12 ? 'ອາຍັດຊົ່ວຄາວ – ບັດເສຍ' : null } });
  }

  // Requests still waiting for the bursar, plus one rejected slip.
  const waiting: { idx: number; amount: number; minsAgo: number; method: 'mobile_banking' | 'cash' }[] = [
    { idx: 8, amount: 500000, minsAgo: 8, method: 'mobile_banking' },
    { idx: 9, amount: 1200000, minsAgo: 14, method: 'mobile_banking' },
    { idx: 10, amount: 300000, minsAgo: 26, method: 'cash' },
    { idx: 11, amount: 250000, minsAgo: 38, method: 'mobile_banking' },
    { idx: 3, amount: 100000, minsAgo: 95, method: 'mobile_banking' },
  ];
  for (const w of waiting) {
    await prisma.topUpRequest.create({ data: {
      studentId: students[w.idx].id, parentUserId: parentOf[w.idx], amount: w.amount, method: w.method,
      methodLabelEn: w.method === 'cash' ? 'Cash at bursar desk' : bcelLabel.en, methodLabelLo: w.method === 'cash' ? 'ເງິນສົດທີ່ຫ້ອງການເງິນ' : bcelLabel.lo,
      status: 'pending', requestedAt: new Date(NOW.getTime() - w.minsAgo * 60 * 1000),
    } });
  }
  await prisma.topUpRequest.create({ data: {
    studentId: students[23].id, parentUserId: parentOf[23], amount: 250000, method: 'mobile_banking',
    methodLabelEn: bcelLabel.en, methodLabelLo: bcelLabel.lo, status: 'rejected', approvedBy: admin.userId,
    rejectReason: 'ຈຳນວນເງິນໃນສະລິບ (25,000 ກີບ) ບໍ່ກົງກັບຄຳຮ້ອງ', requestedAt: at(addDays(TODAY, -2), 18, 10), processedAt: at(addDays(TODAY, -1), 8, 5),
  } });

  // ── Grades: this month's test + homework ──
  const month = schoolDateString(NOW).slice(0, 7);
  const monthly = gradeTypes.find((g) => /month/i.test(g.typeNameEn)) ?? gradeTypes[0];
  const homework = gradeTypes.find((g) => /home/i.test(g.typeNameEn));
  const gradeRows: Prisma.GradeCreateManyInput[] = [];
  for (const s of students) {
    const ability = 55 + rand() * 40; // each student has a consistent level
    for (const sub of SUBJECTS) {
      const csId = classSubject[`${s.classIdx}:${sub.code}`];
      const published = ['MATH', 'LAO', 'ENG'].includes(sub.code);
      for (const type of [monthly, homework].filter(Boolean)) {
        const score = Math.max(20, Math.min(100, Math.round((ability + (rand() - 0.5) * 20) * 2) / 2));
        gradeRows.push({
          studentId: s.id, classSubjectId: csId, teacherId: teacherId[sub.teacher], gradeTypeId: type!.typeId,
          score, maxScore: 100, gradeMonth: month, isPublished: published,
          remarks: score >= 90 ? 'ດີເລີດ' : score < 50 ? 'ຕ້ອງການຊ່ວຍເຫຼືອເພີ່ມ' : null,
        });
      }
    }
  }
  await prisma.grade.createMany({ data: gradeRows });

  // ── Fees: this year's tuition, books and uniform, billed and partly paid ──
  const feeTypeIds: Record<string, number> = {};
  for (const ft of FEE_TYPES) {
    const existing = await prisma.feeType.findFirst({ where: { nameEn: ft.en } });
    feeTypeIds[ft.key] = (existing ?? await prisma.feeType.create({
      data: { nameEn: ft.en, nameLo: ft.lo, descriptionEn: ft.descEn, descriptionLo: ft.descLo },
    })).feeTypeId;
  }
  const structures: { id: number; classIdx: number | null; amount: number; dueDate: Date }[] = [];
  for (const [ci, classId] of classIds.entries()) {
    const st = await prisma.feeStructure.create({ data: {
      feeTypeId: feeTypeIds.tuition, academicYear: year, termId: term1.termId, classId,
      amount: TUITION_BY_CLASS[ci], dueDate: new Date(`${y1}-09-15T00:00:00Z`), createdBy: admin.userId,
    } });
    structures.push({ id: st.feeStructureId, classIdx: ci, amount: TUITION_BY_CLASS[ci], dueDate: st.dueDate });
  }
  for (const [key, amount, due] of [['books', 450_000, `${y1}-09-30`], ['uniform', 350_000, `${y1}-10-15`]] as const) {
    const st = await prisma.feeStructure.create({ data: {
      feeTypeId: feeTypeIds[key], academicYear: year, classId: null, amount, dueDate: new Date(`${due}T00:00:00Z`), createdBy: admin.userId,
    } });
    structures.push({ id: st.feeStructureId, classIdx: null, amount, dueDate: st.dueDate });
  }
  let invoiceCount = 0;
  let paymentCount = 0;
  const pad = (n: number) => String(n).padStart(5, '0');
  for (const [i, s] of students.entries()) {
    // Families differ: most pay in full, some in instalments, a few are behind.
    const habit = i % 7 === 3 ? 'none' : i % 5 === 1 ? 'partial' : 'full';
    for (const st of structures.filter((x) => x.classIdx === null || x.classIdx === s.classIdx)) {
      const inv = await prisma.invoice.create({ data: {
        invoiceNo: `TMP-${st.id}-${s.id}`, studentId: s.id, feeStructureId: st.id, amount: st.amount, dueDate: st.dueDate,
        discount: i === 29 ? Math.round(st.amount * 0.1) : 0, issuedBy: admin.userId, issuedAt: new Date(`${y1}-09-01T02:00:00Z`),
        notes: i === 29 ? 'ສ່ວນຫຼຸດ 10% ສຳລັບລູກຄົນທີສອງ' : null,
      } });
      await prisma.invoice.update({ where: { invoiceId: inv.invoiceId }, data: { invoiceNo: `INV-${y1}-${pad(inv.invoiceId)}` } });
      invoiceCount++;
      const due = st.amount - Number(inv.discount);
      const upcoming = st.dueDate > TODAY;
      const pays = habit === 'none' || (upcoming && rand() < 0.5)
        ? [] : habit === 'partial' ? [Math.round(due / 2 / 1000) * 1000] : [due];
      let paid = 0;
      for (const amount of pays) {
        const paidAt = at(addDays(TODAY, -randInt(1, 20)), randInt(8, 15), randInt(0, 59));
        const method = rand() < 0.6 ? 'bank_transfer' as const : 'cash' as const;
        const pay = await prisma.feePayment.create({ data: {
          receiptNo: `TMP-${inv.invoiceId}-${paymentCount}`, invoiceId: inv.invoiceId, amount, method, paidAt, receivedBy: admin.userId,
          referenceNo: method === 'bank_transfer' ? `BCEL${randInt(10_000_000, 99_999_999)}` : null,
        } });
        await prisma.feePayment.update({ where: { paymentId: pay.paymentId }, data: { receiptNo: `RCPT-${paidAt.getUTCFullYear()}-${pad(pay.paymentId)}` } });
        paid += amount;
        paymentCount++;
      }
      await prisma.invoice.update({
        where: { invoiceId: inv.invoiceId },
        data: { paidAmount: paid, status: paid >= due ? 'paid' : paid > 0 ? 'partial' : 'unpaid' },
      });
    }
  }

  // ── A bursar: a staff role that only sees money and students ──
  const bursarRole = (await prisma.role.findUnique({ where: { code: 'bursar' } })) ?? await prisma.role.create({ data: {
    code: 'bursar', nameEn: 'Bursar', nameLo: 'ພະນັກງານການເງິນ', portal: 'admin', isSystem: false,
    permissions: { create: BURSAR_PERMISSIONS.map((permission) => ({ permission })) },
  } });
  await prisma.user.create({ data: {
    fullNameLo: 'ພອນສະຫວັນ ແກ້ວປະເສີດ', fullNameEn: 'Phonsavanh Keoprasert', email: `bursar${DEMO_DOMAIN}`,
    phoneNumber: '+856 20 5550 0900', passwordHash, roleId: bursarRole.roleId,
  } });

  // ── Announcements ──
  const announcements = ANNOUNCEMENTS.map((a) => ({ ...a, classId: a.forClass === null ? null : classIds[a.forClass] }));
  for (const a of announcements) {
    await prisma.announcement.create({ data: {
      titleEn: a.en, titleLo: a.lo, contentEn: a.cEn, contentLo: a.cLo, targetAudience: a.audience, classId: a.classId,
      publishDate: at(addDays(TODAY, a.days), 7, 30), expiryDate: addDays(TODAY, a.expires), createdBy: admin.userId,
    } });
  }

  console.log([
    'Demo data created:',
    `  ${TEACHERS.length} teachers, ${CLASSES.length} classes, ${SUBJECTS.length} subjects, ${scheduleRows.length} timetable slots`,
    `  ${STUDENTS.length} students, ${PARENTS.length} parents, ${logs.length} gate taps, ${daily.length} daily attendance rows`,
    `  ${gradeRows.length} grades, ${leaves.length} leave requests, ${waiting.length} pending top-ups, ${invoiceCount} invoices, ${paymentCount} fee payments`,
    `  Staff role "bursar" (finance only): bursar${DEMO_DOMAIN}`,
    `Logins (password "${DEMO_PASSWORD}"): teacher1${DEMO_DOMAIN} … teacher${TEACHERS.length}${DEMO_DOMAIN}, parent1${DEMO_DOMAIN} … parent${PARENTS.length}${DEMO_DOMAIN}`,
  ].join('\n'));
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
