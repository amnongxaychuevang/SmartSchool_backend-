import prisma from '../database/PrismaClient';

// storedName stays server-side: clients only ever see the document id.
const PUBLIC_SELECT = {
  documentId: true, teacherId: true, title: true, originalName: true, sizeBytes: true, createdAt: true,
} as const;

class TeacherDocumentRepository {
  async list(teacherId: number) {
    return prisma.teacherDocument.findMany({
      where: { teacherId },
      select: PUBLIC_SELECT,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Includes storedName — for streaming/deleting the file only. */
  async find(teacherId: number, documentId: number) {
    return prisma.teacherDocument.findFirst({ where: { documentId, teacherId } });
  }

  async create(data: { teacherId: number; title: string; originalName: string; storedName: string; sizeBytes: number; uploadedBy?: number | null }) {
    return prisma.teacherDocument.create({ data, select: PUBLIC_SELECT });
  }

  async delete(documentId: number) {
    await prisma.teacherDocument.delete({ where: { documentId } });
  }
}

export default new TeacherDocumentRepository();
