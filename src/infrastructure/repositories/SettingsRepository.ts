import prisma from '../database/PrismaClient';

class SettingsRepository {
  async getAll() {
    const rows = await prisma.schoolSettings.findMany();
    // Convert array of {key, value} to a plain object for easy use
    return rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {});
  }

  async upsertMany(settings) {
    // settings = { key: value, key: value, ... }
    const ops = Object.entries(settings).map(([key, value]) =>
      prisma.schoolSettings.upsert({
        where: { key },
        create: { key, value: String(value) },
        update: { value: String(value) },
      })
    );
    await Promise.all(ops);
    return this.getAll();
  }
}

export default new SettingsRepository();
