import CreateParentUseCase from '../../application/use-cases/parents/CreateParentUseCase';
import UpdateParentUseCase from '../../application/use-cases/parents/UpdateParentUseCase';
import DeleteParentUseCase from '../../application/use-cases/parents/DeleteParentUseCase';
import parentRepository from '../../infrastructure/repositories/ParentRepository';

const createParentUseCase = new CreateParentUseCase(parentRepository);
const updateParentUseCase = new UpdateParentUseCase(parentRepository);
const deleteParentUseCase = new DeleteParentUseCase(parentRepository);

class ParentController {
  async list(req, res, next) {
    try {
      const { search = '', page = 1, limit = 20 } = req.query;
      const result = await parentRepository.findMany({
        search,
        page: parseInt(page),
        limit: parseInt(limit),
      });
      res.json({ success: true, data: result });
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

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      await deleteParentUseCase.execute(id);
      res.json({ success: true });
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

  async getAnnouncements(req, res, next) {
    try {
      const announcements = await parentRepository.getAnnouncements();
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
