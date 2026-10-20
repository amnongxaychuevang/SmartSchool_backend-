import CreateTeacherUseCase from '../../application/use-cases/teachers/CreateTeacherUseCase';
import UpdateTeacherUseCase from '../../application/use-cases/teachers/UpdateTeacherUseCase';
import teacherRepository from '../../infrastructure/repositories/TeacherRepository';
import { savePhoto, removePhoto } from '../../infrastructure/storage/PhotoStorage';
import teacherDocumentRepository from '../../infrastructure/repositories/TeacherDocumentRepository';
import auditLogRepository from '../../infrastructure/repositories/AuditLogRepository';
import { savePdf, privateFilePath, removePrivateFile } from '../../infrastructure/storage/DocumentStorage';

const DOCS_FOLDER = 'teacher-documents';

// Browsers send the file name as UTF-8 bytes that can arrive read as latin1
// ("à»" soup for Lao names); repair that, leave already-correct names alone.
const decodeFileName = (name: string) => {
  if (/[^\u0000-\u00ff]/.test(name)) return name;
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('\uFFFD') ? name : decoded;
};

const createTeacherUseCase = new CreateTeacherUseCase(teacherRepository);
const updateTeacherUseCase = new UpdateTeacherUseCase(teacherRepository);

class TeacherController {
  async list(req, res, next) {
    try {
      const { search = '', page = 1, limit = 20, status, gender } = req.query;
      const result = await teacherRepository.findMany({
        search,
        page: parseInt(page),
        limit: parseInt(limit),
        status,
        gender: ['male', 'female', 'other'].includes(gender) ? gender : undefined,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async options(req, res, next) {
    try {
      res.json({ success: true, data: { teachers: await teacherRepository.findOptions() } });
    } catch (error) {
      next(error);
    }
  }

  async get(req, res, next) {
    try {
      const teacher = await teacherRepository.findById(req.params.id);
      if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found' });
      res.json({ success: true, data: { teacher } });
    } catch (error) {
      next(error);
    }
  }

  async uploadPhoto(req, res, next) {
    let saved: string | null = null;
    try {
      const existing = await teacherRepository.findById(req.params.id);
      if (!existing) return res.status(404).json({ success: false, message: 'Teacher not found' });

      saved = await savePhoto(req.file.buffer, 'teachers');
      await teacherRepository.setPhoto(existing.userId, saved);
      await removePhoto(existing.user.avatarUrl);
      res.json({ success: true, data: { teacher: await teacherRepository.findById(existing.teacherId) } });
    } catch (error) {
      await removePhoto(saved); // don't leave an orphan file if the DB update failed
      next(error);
    }
  }

  async deletePhoto(req, res, next) {
    try {
      const existing = await teacherRepository.findById(req.params.id);
      if (!existing) return res.status(404).json({ success: false, message: 'Teacher not found' });
      await teacherRepository.setPhoto(existing.userId, null);
      await removePhoto(existing.user.avatarUrl);
      res.json({ success: true, data: { teacher: await teacherRepository.findById(existing.teacherId) } });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const teacher = await createTeacherUseCase.execute(req.body);
      res.status(201).json({ success: true, data: { teacher } });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const teacher = await updateTeacherUseCase.execute(id, req.body);
      res.json({ success: true, data: { teacher } });
    } catch (error) {
      next(error);
    }
  }


  // ── Signed documents (contracts) ──────────────────────────
  async listDocuments(req, res, next) {
    try {
      const teacher = await teacherRepository.findById(req.params.id);
      if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found' });
      const documents = await teacherDocumentRepository.list(teacher.teacherId);
      res.json({ success: true, data: { documents } });
    } catch (error) {
      next(error);
    }
  }

  async uploadDocument(req, res, next) {
    let storedName: string | null = null;
    try {
      const teacher = await teacherRepository.findById(req.params.id);
      if (!teacher) return res.status(404).json({ success: false, message: 'Teacher not found' });

      const originalName = decodeFileName(req.file.originalname || 'document.pdf').slice(0, 255);
      const title = (String(req.body?.title ?? '').trim() || originalName.replace(/\.pdf$/i, '')).slice(0, 150);

      storedName = await savePdf(req.file.buffer, DOCS_FOLDER);
      const document = await teacherDocumentRepository.create({
        teacherId: teacher.teacherId,
        title,
        originalName,
        storedName,
        sizeBytes: req.file.size,
        uploadedBy: req.user?.userId ?? null,
      });
      auditLogRepository.log({
        userId: req.user?.userId,
        action: 'create',
        entityType: 'teacher_document',
        entityId: document.documentId,
        detail: { teacherId: teacher.teacherId, title },
        ipAddress: req.ip,
      });
      res.status(201).json({ success: true, data: { document } });
    } catch (error) {
      await removePrivateFile(DOCS_FOLDER, storedName); // no orphan file if the DB insert failed
      next(error);
    }
  }

  async downloadDocument(req, res, next) {
    try {
      const doc = await teacherDocumentRepository.find(Number(req.params.id), Number(req.params.documentId));
      if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`);
      res.setHeader('Cache-Control', 'private, no-store');
      res.sendFile(privateFilePath(DOCS_FOLDER, doc.storedName), (err) => {
        if (err && !res.headersSent) res.status(404).json({ success: false, message: 'File not found' });
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteDocument(req, res, next) {
    try {
      const doc = await teacherDocumentRepository.find(Number(req.params.id), Number(req.params.documentId));
      if (!doc) return res.status(404).json({ success: false, message: 'Document not found' });
      await teacherDocumentRepository.delete(doc.documentId);
      await removePrivateFile(DOCS_FOLDER, doc.storedName);
      auditLogRepository.log({
        userId: req.user?.userId,
        action: 'delete',
        entityType: 'teacher_document',
        entityId: doc.documentId,
        detail: { teacherId: doc.teacherId, title: doc.title },
        ipAddress: req.ip,
      });
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

export default new TeacherController();
