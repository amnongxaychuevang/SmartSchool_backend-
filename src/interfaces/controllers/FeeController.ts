import prisma from '../../infrastructure/database/PrismaClient';
import feeRepository from '../../infrastructure/repositories/FeeRepository';
import auditLogRepository from '../../infrastructure/repositories/AuditLogRepository';
import { getCurrentAcademicYear } from '../../infrastructure/repositories/AcademicYear';

const id = (req) => Number(req.params.id);
const audit = (req, action: string, entityType: string, entityId: number, detail?: unknown) =>
  auditLogRepository.log({ userId: req.user.userId, action, entityType, entityId, detail, ipAddress: req.ip });

// Express 5 forwards rejected promises to the error handler, so handlers can simply throw.
const FeeController = {
  // ── Fee types ──
  async listTypes(req, res) {
    res.json({ success: true, data: { feeTypes: await feeRepository.listTypes() } });
  },
  async createType(req, res) {
    const feeType = await feeRepository.createType(req.body);
    audit(req, 'create', 'fee_type', feeType.feeTypeId, req.body);
    res.status(201).json({ success: true, data: { feeType } });
  },
  async updateType(req, res) {
    const feeType = await feeRepository.updateType(id(req), req.body);
    audit(req, 'update', 'fee_type', feeType.feeTypeId, req.body);
    res.json({ success: true, data: { feeType } });
  },
  async deleteType(req, res) {
    await feeRepository.deleteType(id(req));
    audit(req, 'delete', 'fee_type', id(req));
    res.json({ success: true });
  },

  // ── Fee structures ──
  async listStructures(req, res) {
    const academicYear = typeof req.query.academicYear === 'string' ? req.query.academicYear : undefined;
    res.json({ success: true, data: { structures: await feeRepository.listStructures(academicYear) } });
  },
  async createStructure(req, res) {
    const structure = await feeRepository.createStructure({ ...req.body, createdBy: req.user.userId });
    audit(req, 'create', 'fee_structure', structure.feeStructureId, req.body);
    res.status(201).json({ success: true, data: { structure } });
  },
  async updateStructure(req, res) {
    const structure = await feeRepository.updateStructure(id(req), req.body);
    audit(req, 'update', 'fee_structure', structure.feeStructureId, req.body);
    res.json({ success: true, data: { structure } });
  },
  async deleteStructure(req, res) {
    await feeRepository.deleteStructure(id(req));
    audit(req, 'delete', 'fee_structure', id(req));
    res.json({ success: true });
  },
  async generateInvoices(req, res) {
    const result = await feeRepository.generateInvoices(id(req), req.user.userId);
    audit(req, 'create', 'invoice', id(req), { generatedForStructure: id(req), ...result });
    res.status(201).json({ success: true, data: result });
  },

  // ── Invoices ──
  async listInvoices(req, res) {
    const q = req.query;
    const result = await feeRepository.listInvoices({
      status: q.status, search: q.search, academicYear: q.academicYear,
      studentId: q.studentId ? Number(q.studentId) : undefined,
      classId: q.classId ? Number(q.classId) : undefined,
      feeStructureId: q.feeStructureId ? Number(q.feeStructureId) : undefined,
    }, Number(q.page) || 1, Math.min(Number(q.limit) || 20, 200));
    res.json({ success: true, data: result });
  },
  async getInvoice(req, res) {
    res.json({ success: true, data: { invoice: await feeRepository.getInvoice(id(req)) } });
  },
  async updateInvoice(req, res) {
    const invoice = await feeRepository.updateInvoice(id(req), req.body);
    audit(req, 'update', 'invoice', id(req), req.body);
    res.json({ success: true, data: { invoice } });
  },
  async voidInvoice(req, res) {
    const invoice = await feeRepository.voidInvoice(id(req), req.body.reason);
    audit(req, 'status_change', 'invoice', id(req), { status: 'void', reason: req.body.reason });
    res.json({ success: true, data: { invoice } });
  },
  async recordPayment(req, res) {
    const payment = await feeRepository.recordPayment(id(req), req.body, req.user.userId);
    audit(req, 'create', 'fee_payment', payment.paymentId, { invoiceId: id(req), amount: payment.amount, method: payment.method, receiptNo: payment.receiptNo });
    res.status(201).json({ success: true, data: { payment, invoice: await feeRepository.getInvoice(id(req)) } });
  },

  // ── Report ──
  async report(req, res) {
    const academicYear = typeof req.query.academicYear === 'string' ? req.query.academicYear : await getCurrentAcademicYear();
    res.json({ success: true, data: await feeRepository.report(academicYear) });
  },

  // ── Parent: a child's invoices ──
  async childInvoices(req, res) {
    const studentId = Number(req.params.studentId);
    const link = await prisma.parentStudent.findUnique({
      where: { uq_parent_student: { parentUserId: req.user.userId, studentId } },
    });
    if (!link) return res.status(403).json({ success: false, message: 'Unauthorized or not your child' });
    res.json({ success: true, data: { invoices: await feeRepository.invoicesForStudent(studentId) } });
  },
};

export default FeeController;
