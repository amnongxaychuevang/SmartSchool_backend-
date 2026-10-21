import prisma from '../../infrastructure/database/PrismaClient';
import receiptRepository from '../../infrastructure/repositories/ReceiptRepository';

// Staff reach these through their permission (checked on the route); a parent only
// for their own child — the receipt is loaded first, then the link is checked.
async function assertParentOf(req, studentId: number) {
  if (req.user.role !== 'parent') return;
  const link = await prisma.parentStudent.findUnique({
    where: { uq_parent_student: { parentUserId: req.user.userId, studentId } },
  });
  // 404, not 403: a parent should not learn that someone else's receipt number exists.
  if (!link) throw Object.assign(new Error('Receipt not found'), { statusCode: 404 });
}

// Express 5 forwards rejected promises to the error handler, so handlers can simply throw.
const ReceiptController = {
  // GET /receipts/fee/:paymentId
  async feePayment(req, res) {
    const receipt = await receiptRepository.feePayment(Number(req.params.paymentId));
    await assertParentOf(req, receipt.student.studentId);
    res.json({ success: true, data: { receipt } });
  },

  // GET /receipts/topup/:transactionId
  async topUp(req, res) {
    const receipt = await receiptRepository.topUp(Number(req.params.transactionId));
    await assertParentOf(req, receipt.student.studentId);
    res.json({ success: true, data: { receipt } });
  },
};

export default ReceiptController;
