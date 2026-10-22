import payrollRepository from '../../infrastructure/repositories/PayrollRepository';
import auditLogRepository from '../../infrastructure/repositories/AuditLogRepository';
import { buildWorkbook, sendWorkbook, exportLang, type ExportColumn } from '../../infrastructure/export/excel';
import { saveSlip, removePhoto } from '../../infrastructure/storage/PhotoStorage';
import prisma from '../../infrastructure/database/PrismaClient';

class PayrollController {
  async listPeriods(req: any, res: any, next: any) {
    try {
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;
      const result = await payrollRepository.listPeriods({ page, limit });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async generatePeriod(req: any, res: any, next: any) {
    try {
      const { periodMonth, notes } = req.body;
      const period = await payrollRepository.generatePeriod(periodMonth, notes);

      await auditLogRepository.log({
        userId: req.user.userId,
        action: 'create',
        entityType: 'payroll_period',
        entityId: String(period.periodId),
        detail: { periodMonth, notes },
        ipAddress: req.ip,
      });

      res.status(201).json({ success: true, data: { period }, message: 'Payroll period generated' });
    } catch (error) {
      next(error);
    }
  }

  async getPeriod(req: any, res: any, next: any) {
    try {
      const periodId = parseInt(req.params.id, 10);
      const period = await payrollRepository.findPeriodById(periodId);
      if (!period) {
        return res.status(404).json({ success: false, message: 'Payroll period not found' });
      }
      res.json({ success: true, data: { period } });
    } catch (error) {
      next(error);
    }
  }

  async updateItem(req: any, res: any, next: any) {
    try {
      const itemId = parseInt(req.params.id, 10);
      const item = await payrollRepository.updateItem(itemId, req.body);

      await auditLogRepository.log({
        userId: req.user.userId,
        action: 'update',
        entityType: 'payroll_item',
        entityId: String(itemId),
        detail: req.body,
        ipAddress: req.ip,
      });

      res.json({ success: true, data: { item }, message: 'Payroll item updated' });
    } catch (error) {
      next(error);
    }
  }

  async uploadSlip(req: any, res: any, next: any) {
    try {
      const itemId = parseInt(req.params.id, 10);
      if (!req.file?.buffer) {
        return res.status(400).json({ success: false, message: 'No slip image uploaded' });
      }

      // If an existing slip exists, remove old file first
      const existing = await prisma.payrollItem.findUnique({ where: { itemId } });
      if (existing?.slipUrl) {
        await removePhoto(existing.slipUrl);
      }

      const slipUrl = await saveSlip(req.file.buffer);
      const item = await payrollRepository.updateItemSlip(itemId, slipUrl);

      await auditLogRepository.log({
        userId: req.user.userId,
        action: 'upload_slip',
        entityType: 'payroll_item',
        entityId: String(itemId),
        detail: { slipUrl, teacherId: item.teacherId },
        ipAddress: req.ip,
      });

      res.json({ success: true, data: { item }, message: 'Slip uploaded successfully' });
    } catch (error) {
      next(error);
    }
  }

  async deleteSlip(req: any, res: any, next: any) {
    try {
      const itemId = parseInt(req.params.id, 10);
      const existing = await prisma.payrollItem.findUnique({ where: { itemId } });
      if (existing?.slipUrl) {
        await removePhoto(existing.slipUrl);
      }
      const item = await payrollRepository.updateItemSlip(itemId, null);

      await auditLogRepository.log({
        userId: req.user.userId,
        action: 'delete_slip',
        entityType: 'payroll_item',
        entityId: String(itemId),
        detail: { teacherId: item.teacherId },
        ipAddress: req.ip,
      });

      res.json({ success: true, data: { item }, message: 'Slip deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  async updatePeriodStatus(req: any, res: any, next: any) {
    try {
      const periodId = parseInt(req.params.id, 10);
      const { status } = req.body;
      const period = await payrollRepository.updatePeriodStatus(periodId, status);

      await auditLogRepository.log({
        userId: req.user.userId,
        action: 'status_change',
        entityType: 'payroll_period',
        entityId: String(periodId),
        detail: { status },
        ipAddress: req.ip,
      });

      res.json({ success: true, data: { period }, message: `Payroll status updated to ${status}` });
    } catch (error) {
      next(error);
    }
  }

  async deletePeriod(req: any, res: any, next: any) {
    try {
      const periodId = parseInt(req.params.id, 10);
      await payrollRepository.deletePeriod(periodId);

      await auditLogRepository.log({
        userId: req.user.userId,
        action: 'delete',
        entityType: 'payroll_period',
        entityId: String(periodId),
        detail: {},
        ipAddress: req.ip,
      });

      res.json({ success: true, message: 'Payroll period deleted' });
    } catch (error) {
      next(error);
    }
  }

  async exportBankTransfer(req: any, res: any, next: any) {
    try {
      const periodId = parseInt(req.params.id, 10);
      const period = await payrollRepository.findPeriodById(periodId);
      if (!period) {
        return res.status(404).json({ success: false, message: 'Payroll period not found' });
      }

      const lang = exportLang(req);
      const columns: ExportColumn<any>[] = [
        { header: { lo: 'ລະຫັດພະນັກງານ', en: 'Employee Code' }, value: (r) => r.teacher?.employeeCode, width: 16 },
        { header: { lo: 'ຊື່ ແລະ ນາມສະກຸນ (ລາວ)', en: 'Full Name (Lao)' }, value: (r) => r.teacher?.user?.fullNameLo, width: 25 },
        { header: { lo: 'ຊື່ ແລະ ນາມສະກຸນ (Eng)', en: 'Full Name (En)' }, value: (r) => r.teacher?.user?.fullNameEn, width: 25 },
        { header: { lo: 'ທະນາຄານ', en: 'Bank Name' }, value: (r) => r.bankName || 'BCEL', width: 14 },
        { header: { lo: 'ຊື່ບັນຊີ', en: 'Account Name' }, value: (r) => r.bankAccountName || r.teacher?.user?.fullNameEn, width: 25 },
        { header: { lo: 'ເລກບັນຊີ', en: 'Account Number' }, value: (r) => r.bankAccountNumber, width: 20 },
        { header: { lo: 'ເງິນເດືອນພື້ນຖານ (₭)', en: 'Base Salary (LAK)' }, value: (r) => r.baseSalary, width: 18 },
        { header: { lo: 'ເງິນອຸດໜູນ/ສອນພິເສດ (₭)', en: 'Teaching Allowance' }, value: (r) => r.teachingAllowance, width: 18 },
        { header: { lo: 'ເບ້ຍຂະຫຍັນ (₭)', en: 'Attendance Bonus' }, value: (r) => r.attendanceBonus, width: 16 },
        { header: { lo: 'ເງິນອຸດໜູນອື່ນໆ (₭)', en: 'Other Allowances' }, value: (r) => r.otherAllowance, width: 16 },
        { header: { lo: 'ຫັກຂາດ/ມາຊ້າ (₭)', en: 'Absence Deduction' }, value: (r) => r.absenceDeduction, width: 16 },
        { header: { lo: 'ຫັກອາກອນ (₭)', en: 'Tax Deduction' }, value: (r) => r.taxDeduction, width: 16 },
        { header: { lo: 'ຫັກອື່ນໆ (₭)', en: 'Other Deductions' }, value: (r) => r.otherDeduction, width: 16 },
        { header: { lo: 'ຍອດຈ່າຍສຸດທິ (₭)', en: 'Net Payout (LAK)' }, value: (r) => r.netSalary, width: 20 },
        { header: { lo: 'ສະຖານະ', en: 'Status' }, value: (r) => r.status, width: 12 },
        { header: { lo: 'ໝາຍເຫດ', en: 'Notes' }, value: (r) => r.notes, width: 25 },
      ];

      const buffer = buildWorkbook(period.periodMonth, columns, period.items, lang);

      await auditLogRepository.log({
        userId: req.user.userId,
        action: 'export',
        entityType: 'payroll_period',
        entityId: String(periodId),
        detail: { periodMonth: period.periodMonth, rowCount: period.items.length },
        ipAddress: req.ip,
      });

      sendWorkbook(res, `payroll-${period.periodMonth}`, buffer);
    } catch (error) {
      next(error);
    }
  }

  async getMyPayslips(req: any, res: any, next: any) {
    try {
      const payslips = await payrollRepository.findTeacherPayslips(req.user.userId);
      res.json({ success: true, data: { payslips } });
    } catch (error) {
      next(error);
    }
  }

  async getMyPayslip(req: any, res: any, next: any) {
    try {
      const itemId = parseInt(req.params.id, 10);
      const payslip = await payrollRepository.findTeacherPayslip(req.user.userId, itemId);
      if (!payslip) {
        return res.status(404).json({ success: false, message: 'Payslip not found' });
      }
      res.json({ success: true, data: { payslip } });
    } catch (error) {
      next(error);
    }
  }
}

export default new PayrollController();
