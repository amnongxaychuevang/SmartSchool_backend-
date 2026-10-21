import prisma from '../database/PrismaClient';
import { schoolDateValue } from '../../domain/schoolTime';

const fail = (message: string, statusCode: number) => Object.assign(new Error(message), { statusCode });

export interface SchoolEventInput {
  titleEn: string;
  titleLo: string;
  descriptionEn?: string | null;
  descriptionLo?: string | null;
  type: 'holiday' | 'exam' | 'activity' | 'meeting' | 'other';
  startDate: string; // YYYY-MM-DD
  endDate: string;
  schoolClosed: boolean;
}

const toData = (e: SchoolEventInput) => {
  if (e.endDate < e.startDate) throw fail('The end date is before the start date', 400);
  return {
    titleEn: e.titleEn, titleLo: e.titleLo,
    descriptionEn: e.descriptionEn || null, descriptionLo: e.descriptionLo || null,
    type: e.type,
    startDate: schoolDateValue(e.startDate), endDate: schoolDateValue(e.endDate),
    schoolClosed: e.schoolClosed,
  };
};

class SchoolEventRepository {
  /** Events touching [from, to] (inclusive, YYYY-MM-DD), in date order. */
  async findBetween(from: string, to: string) {
    return prisma.schoolEvent.findMany({
      where: { startDate: { lte: schoolDateValue(to) }, endDate: { gte: schoolDateValue(from) } },
      orderBy: [{ startDate: 'asc' }, { eventId: 'asc' }],
    });
  }

  /** The upcoming (or ongoing) events from `day` on. */
  async findUpcoming(day: Date, limit: number) {
    return prisma.schoolEvent.findMany({
      where: { endDate: { gte: day } },
      orderBy: [{ startDate: 'asc' }, { eventId: 'asc' }],
      take: limit,
    });
  }

  /**
   * For the dashboard: the next calendar events (ongoing ones included) and term
   * starts, merged in date order, in the widget's shape.
   */
  async upcomingForDashboard(limit: number) {
    const today = schoolDateValue();
    const [events, terms] = await Promise.all([
      this.findUpcoming(today, limit),
      prisma.academicTerm.findMany({
        where: { startDate: { gte: today } },
        orderBy: { startDate: 'asc' },
        take: limit,
        select: { termId: true, termNameEn: true, termNameLo: true, startDate: true, endDate: true },
      }),
    ]);
    return [
      ...events.map((e) => ({
        id: `event-${e.eventId}`, nameEn: e.titleEn, nameLo: e.titleLo,
        descriptionEn: e.descriptionEn, descriptionLo: e.descriptionLo,
        date: e.startDate.toISOString(), endDate: e.endDate.toISOString(), type: e.type, schoolClosed: e.schoolClosed,
      })),
      ...terms.map((t) => ({
        id: `term-${t.termId}`, nameEn: t.termNameEn, nameLo: t.termNameLo,
        descriptionEn: null, descriptionLo: null,
        date: t.startDate.toISOString(), endDate: t.endDate.toISOString(), type: 'term', schoolClosed: false,
      })),
    ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, limit);
  }

  /** A day-off event covering `day` (a school date), if any. */
  async findClosureOn(day: Date) {
    return prisma.schoolEvent.findFirst({
      where: { schoolClosed: true, startDate: { lte: day }, endDate: { gte: day } },
      select: { eventId: true, titleEn: true, titleLo: true },
    });
  }

  async create(input: SchoolEventInput, createdBy: number) {
    return prisma.schoolEvent.create({ data: { ...toData(input), createdBy } });
  }

  async update(eventId: number, input: SchoolEventInput) {
    const exists = await prisma.schoolEvent.findUnique({ where: { eventId }, select: { eventId: true } });
    if (!exists) throw fail('Event not found', 404);
    return prisma.schoolEvent.update({ where: { eventId }, data: toData(input) });
  }

  async delete(eventId: number) {
    const { count } = await prisma.schoolEvent.deleteMany({ where: { eventId } });
    if (!count) throw fail('Event not found', 404);
  }
}

export default new SchoolEventRepository();
