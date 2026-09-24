import prisma from '../database/PrismaClient';

// School-wide settings stored as key → JSON value (see SchoolSetting in the schema).
class SettingsRepository {
  async getAll(): Promise<Record<string, unknown>> {
    const rows = await prisma.schoolSetting.findMany();
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  async upsertMany(settings: Record<string, unknown>, updatedBy?: number) {
    await prisma.$transaction(
      Object.entries(settings).map(([key, value]) =>
        prisma.schoolSetting.upsert({
          where: { key },
          create: { key, value: value as object, updatedBy },
          update: { value: value as object, updatedBy },
        })),
    );
    return this.getAll();
  }
}

export default new SettingsRepository();
