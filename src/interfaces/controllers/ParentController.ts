import CreateParentUseCase from '../../application/use-cases/parents/CreateParentUseCase';
import UpdateParentUseCase from '../../application/use-cases/parents/UpdateParentUseCase';
import parentRepository from '../../infrastructure/repositories/ParentRepository';
import behaviorRepository from '../../infrastructure/repositories/BehaviorRepository';
import busRepository from '../../infrastructure/repositories/BusRepository';
import libraryRepository from '../../infrastructure/repositories/LibraryRepository';
import assignmentRepository from '../../infrastructure/repositories/AssignmentRepository';
import settingsRepository from '../../infrastructure/repositories/SettingsRepository';
import auditLogRepository from '../../infrastructure/repositories/AuditLogRepository';
import { savePhoto, removePhoto } from '../../infrastructure/storage/PhotoStorage';

const createParentUseCase = new CreateParentUseCase(parentRepository);
const updateParentUseCase = new UpdateParentUseCase(parentRepository);

class ParentController {
  async list(req, res, next) {
    try {
      const { search = '', page = 1, limit = 20, status } = req.query;
      const result = await parentRepository.findMany({
        search,
        page: parseInt(page),
        limit: parseInt(limit),
        status,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async get(req, res, next) {
    try {
      const parent = await parentRepository.findById(req.params.id);
      if (!parent) return res.status(404).json({ success: false, message: 'Parent not found' });
      res.json({ success: true, data: { parent } });
    } catch (error) {
      next(error);
    }
  }

  async uploadPhoto(req, res, next) {
    let saved: string | null = null;
    try {
      const existing = await parentRepository.findById(req.params.id);
      if (!existing) return res.status(404).json({ success: false, message: 'Parent not found' });

      saved = await savePhoto(req.file.buffer, 'parents');
      await parentRepository.setPhoto(existing.userId, saved);
      await removePhoto(existing.user.avatarUrl);
      res.json({ success: true, data: { parent: await parentRepository.findById(existing.parentId) } });
    } catch (error) {
      await removePhoto(saved); // don't leave an orphan file if the DB update failed
      next(error);
    }
  }

  async deletePhoto(req, res, next) {
    try {
      const existing = await parentRepository.findById(req.params.id);
      if (!existing) return res.status(404).json({ success: false, message: 'Parent not found' });
      await parentRepository.setPhoto(existing.userId, null);
      await removePhoto(existing.user.avatarUrl);
      res.json({ success: true, data: { parent: await parentRepository.findById(existing.parentId) } });
    } catch (error) {
      next(error);
    }
  }

  async options(req, res, next) {
    try {
      const parents = await parentRepository.findOptions();
      res.json({ success: true, data: { parents } });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const parent = await createParentUseCase.execute(req.body);
      res.status(201).json({ success: true, data: { parent } });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const parent = await updateParentUseCase.execute(id, req.body);
      res.json({ success: true, data: { parent } });
    } catch (error) {
      next(error);
    }
  }

  // --- Parent Portal Endpoints ---

  async getMyChildren(req, res, next) {
    try {
      const parentUserId = req.user.userId;
      const children = await parentRepository.findMyChildren(parentUserId);
      res.json({ success: true, data: children });
    } catch (error) {
      next(error);
    }
  }

  async getChildAttendance(req, res, next) {
    try {
      const parentUserId = req.user.userId;
      const { studentId } = req.params;
      const attendance = await parentRepository.findChildAttendance(studentId, parentUserId);
      res.json({ success: true, data: attendance });
    } catch (error) {
      next(error);
    }
  }

  async getChildBehavior(req, res, next) {
    try {
      await parentRepository.assertChild(req.params.studentId, req.user.userId);
      const conduct = await behaviorRepository.getStudentConduct(Number(req.params.studentId));
      res.json({ success: true, data: { summary: conduct.summary, records: conduct.records } });
    } catch (error) {
      next(error);
    }
  }

  async getChildTransport(req, res, next) {
    try {
      await parentRepository.assertChild(req.params.studentId, req.user.userId);
      res.json({ success: true, data: await busRepository.getStudentTransport(Number(req.params.studentId)) });
    } catch (error) {
      next(error);
    }
  }

  async getChildLibrary(req, res, next) {
    try {
      await parentRepository.assertChild(req.params.studentId, req.user.userId);
      res.json({ success: true, data: { loans: await libraryRepository.getStudentLoans(Number(req.params.studentId)) } });
    } catch (error) {
      next(error);
    }
  }

  async getChildAssignments(req, res, next) {
    try {
      await parentRepository.assertChild(req.params.studentId, req.user.userId);
      res.json({ success: true, data: { assignments: await assignmentRepository.listForStudent(Number(req.params.studentId)) } });
    } catch (error) {
      next(error);
    }
  }

  async getChildGrades(req, res, next) {
    try {
      const parentUserId = req.user.userId;
      const { studentId } = req.params;
      const grades = await parentRepository.findChildGrades(studentId, parentUserId);
      res.json({ success: true, data: grades });
    } catch (error) {
      next(error);
    }
  }

  // GET /parents/me/payment-info — the school account to transfer top-ups to (null until set).
  async getPaymentInfo(req, res, next) {
    try {
      const settings = await settingsRepository.getAll();
      res.json({ success: true, data: settings.paymentInfo ?? null });
    } catch (error) {
      next(error);
    }
  }

  async getChildWallet(req, res, next) {
    try {
      const parentUserId = req.user.userId;
      const { studentId } = req.params;
      const wallet = await parentRepository.findChildWallet(studentId, parentUserId);
      res.json({ success: true, data: wallet });
    } catch (error) {
      next(error);
    }
  }

  async getChildCards(req, res, next) {
    try {
      const cards = await parentRepository.getChildCards(req.params.studentId, req.user.userId);
      res.json({ success: true, data: cards });
    } catch (error) {
      next(error);
    }
  }

  async reportCardLost(req, res, next) {
    try {
      const { studentId, cardId } = req.params;
      const card = await parentRepository.reportCardLost(studentId, cardId, req.user.userId);
      auditLogRepository.log({
        userId: req.user.userId,
        action: 'status_change',
        entityType: 'card',
        entityId: card.cardId,
        detail: { status: 'lost', reportedBy: 'parent', studentId: Number(studentId) },
        ipAddress: req.ip,
      });
      res.json({ success: true, data: card });
    } catch (error) {
      next(error);
    }
  }

  async getAnnouncements(req, res, next) {
    try {
      const announcements = await parentRepository.getAnnouncements(req.user.userId);
      res.json({ success: true, data: announcements });
    } catch (error) {
      next(error);
    }
  }

  async getChildSchedule(req, res, next) {
    try {
      const parentUserId = req.user.userId;
      const { studentId } = req.params;
      const schedule = await parentRepository.getChildSchedule(studentId, parentUserId);
      res.json({ success: true, data: schedule });
    } catch (error) {
      next(error);
    }
  }

  async getLeaveRequests(req, res, next) {
    try {
      const parentUserId = req.user.userId;
      const { studentId } = req.params;
      const leaves = await parentRepository.getLeaveRequests(studentId, parentUserId);
      res.json({ success: true, data: leaves });
    } catch (error) {
      next(error);
    }
  }

  async createLeaveRequest(req, res, next) {
    try {
      const parentUserId = req.user.userId;
      const { studentId } = req.params;
      const leave = await parentRepository.createLeaveRequest(studentId, parentUserId, req.body);

      const socketManager = req.app.get('socketManager');
      if (socketManager) {
        const homeroomTeacherId = leave.student?.classStudents?.[0]?.class?.homeroomTeacherId;
        if (homeroomTeacherId) {
          const studentName = leave.student.fullNameLo || leave.student.fullNameEn;
          socketManager.toUser(homeroomTeacherId, 'new-notification', {
            titleLo: 'ຄຳຂໍລາພັກຂອງນັກຮຽນ',
            titleEn: 'Student Leave Request',
            messageLo: `ນັກຮຽນ ${studentName} ສົ່ງຄຳຂໍລາພັກ ລໍຖ້າການອະນຸມັດ`,
            messageEn: `Student ${studentName} submitted a leave request pending approval`,
            link: '/teacher/leaves',
          });
        }
      }

      res.json({ success: true, data: leave });
    } catch (error) {
      next(error);
    }
  }

  async getSpendingLimits(req, res, next) {
    try {
      const parentUserId = req.user.userId;
      const { studentId } = req.params;
      const limits = await parentRepository.getSpendingLimits(studentId, parentUserId);
      res.json({ success: true, data: limits });
    } catch (error) {
      next(error);
    }
  }

  async updateSpendingLimits(req, res, next) {
    try {
      const parentUserId = req.user.userId;
      const { studentId } = req.params;
      const limits = await parentRepository.updateSpendingLimits(studentId, parentUserId, req.body);
      res.json({ success: true, data: limits });
    } catch (error) {
      next(error);
    }
  }
}

export default new ParentController();
