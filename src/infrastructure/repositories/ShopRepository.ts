import prisma from '../database/PrismaClient';
import { documentNo } from '../../domain/fees';

class ShopRepository {
  async findMany({ search = '', page = 1, limit = 20 }: any = {}) {
    const skip = (page - 1) * limit;
    const where = search
      ? {
          OR: [
            { shopNameEn: { contains: search } },
            { shopNameLo: { contains: search } },
            { vendorName: { contains: search } },
            { vendorPhone: { contains: search } },
          ],
        }
      : {};

    const [shops, total] = await Promise.all([
      prisma.shop.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          rentalPayments: {
            select: {
              rentalPaymentId: true,
              amount: true,
              paidAmount: true,
              status: true,
            },
          },
        },
      }),
      prisma.shop.count({ where }),
    ]);

    const formattedShops = shops.map((shop) => {
      const totalRentalBilled = shop.rentalPayments.reduce((s, r) => s + Number(r.amount), 0);
      const totalRentalPaid = shop.rentalPayments.reduce((s, r) => s + Number(r.paidAmount), 0);
      const outstandingRental = Math.max(totalRentalBilled - totalRentalPaid, 0);
      return {
        ...shop,
        rentalAmount: shop.rentalAmount ? Number(shop.rentalAmount) : null,
        totalRentalBilled,
        totalRentalPaid,
        outstandingRental,
      };
    });

    return { shops: formattedShops, total, page, limit };
  }

  async findById(shopId: number | string) {
    const shop = await prisma.shop.findUnique({
      where: { shopId: parseInt(String(shopId), 10) },
      include: {
        rentalPayments: {
          orderBy: { dueDate: 'desc' },
        },
      },
    });

    if (!shop) return null;

    return {
      ...shop,
      rentalAmount: shop.rentalAmount ? Number(shop.rentalAmount) : null,
      rentalPayments: shop.rentalPayments.map((p) => ({
        ...p,
        amount: Number(p.amount),
        paidAmount: Number(p.paidAmount),
      })),
    };
  }

  async create(data: any) {
    return prisma.shop.create({
      data: {
        ...data,
        rentalAmount: data.rentalAmount !== undefined && data.rentalAmount !== null ? data.rentalAmount : undefined,
      },
    });
  }

  async update(shopId: number | string, data: any) {
    return prisma.shop.update({
      where: { shopId: parseInt(String(shopId), 10) },
      data: {
        ...data,
        rentalAmount: data.rentalAmount !== undefined && data.rentalAmount !== null ? data.rentalAmount : undefined,
      },
    });
  }

  async delete(shopId: number | string) {
    return prisma.shop.delete({ where: { shopId: parseInt(String(shopId), 10) } });
  }

  // ─── Shop Rental Payments ────────────────────────────────
  async listRentalPayments({ shopId, academicYear, status, page = 1, limit = 50 }: any = {}) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (shopId) where.shopId = parseInt(String(shopId), 10);
    if (academicYear) where.academicYear = academicYear;
    if (status) where.status = status;

    const [rows, total] = await Promise.all([
      prisma.shopRentalPayment.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ dueDate: 'desc' }, { rentalPaymentId: 'desc' }],
        include: {
          shop: {
            select: {
              shopId: true,
              shopNameEn: true,
              shopNameLo: true,
              vendorName: true,
              vendorPhone: true,
            },
          },
        },
      }),
      prisma.shopRentalPayment.count({ where }),
    ]);

    const rentalPayments = rows.map((r) => ({
      ...r,
      amount: Number(r.amount),
      paidAmount: Number(r.paidAmount),
      outstanding: Math.max(Number(r.amount) - Number(r.paidAmount), 0),
    }));

    return { rentalPayments, total, page, limit };
  }

  async findRentalPaymentById(rentalPaymentId: number | string) {
    const item = await prisma.shopRentalPayment.findUnique({
      where: { rentalPaymentId: parseInt(String(rentalPaymentId), 10) },
      include: {
        shop: {
          select: {
            shopId: true,
            shopNameEn: true,
            shopNameLo: true,
            vendorName: true,
            vendorPhone: true,
          },
        },
      },
    });
    if (!item) return null;
    return {
      ...item,
      amount: Number(item.amount),
      paidAmount: Number(item.paidAmount),
      outstanding: Math.max(Number(item.amount) - Number(item.paidAmount), 0),
    };
  }

  async createRentalPayment(shopId: number | string, data: any) {
    return prisma.shopRentalPayment.create({
      data: {
        shopId: parseInt(String(shopId), 10),
        academicYear: data.academicYear,
        periodLabel: data.periodLabel,
        dueDate: new Date(data.dueDate),
        amount: data.amount,
        notes: data.notes || null,
        status: 'unpaid',
      },
    });
  }

  async recordRentalPayment(rentalPaymentId: number | string, { amount, paymentMethod, paidAt, notes }: any) {
    const id = parseInt(String(rentalPaymentId), 10);
    const existing = await prisma.shopRentalPayment.findUnique({ where: { rentalPaymentId: id } });
    if (!existing) {
      const err: any = new Error('Rental payment record not found');
      err.statusCode = 404;
      throw err;
    }

    const currentPaid = Number(existing.paidAmount);
    const totalAmount = Number(existing.amount);
    const paymentAmount = Number(amount);
    const newPaidAmount = currentPaid + paymentAmount;
    const newStatus = newPaidAmount >= totalAmount ? 'paid' : newPaidAmount > 0 ? 'partial' : 'unpaid';

    const paymentDate = paidAt ? new Date(paidAt) : new Date();
    const year = paymentDate.getFullYear();
    const receiptNo = existing.receiptNo || documentNo('RCPT', year, existing.rentalPaymentId);

    const updatedNotes = notes
      ? existing.notes ? `${existing.notes}\n${notes}` : notes
      : existing.notes;

    return prisma.shopRentalPayment.update({
      where: { rentalPaymentId: id },
      data: {
        paidAmount: newPaidAmount,
        status: newStatus,
        paymentMethod,
        receiptNo,
        paidAt: paymentDate,
        notes: updatedNotes,
      },
    });
  }

  async setRentalSlip(rentalPaymentId: number | string, slipUrl: string | null) {
    return prisma.shopRentalPayment.update({
      where: { rentalPaymentId: parseInt(String(rentalPaymentId), 10) },
      data: { slipUrl },
    });
  }

  async deleteRentalPayment(rentalPaymentId: number | string) {
    return prisma.shopRentalPayment.delete({
      where: { rentalPaymentId: parseInt(String(rentalPaymentId), 10) },
    });
  }
}

export default new ShopRepository();
