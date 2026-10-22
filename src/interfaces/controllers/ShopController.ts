import shopRepository from '../../infrastructure/repositories/ShopRepository';
import { saveSlip, removePhoto } from '../../infrastructure/storage/PhotoStorage';

class ShopController {
  async list(req, res, next) {
    try {
      const { search = '', page = 1, limit = 20 } = req.query;
      const result = await shopRepository.findMany({
        search,
        page: parseInt(page),
        limit: parseInt(limit),
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async get(req, res, next) {
    try {
      const shop = await shopRepository.findById(req.params.id);
      if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });
      res.json({ success: true, data: { shop } });
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const {
        shopNameEn,
        shopNameLo,
        locationEn,
        locationLo,
        descriptionEn,
        descriptionLo,
        vendorName,
        vendorPhone,
        rentalBillingType,
        rentalAmount,
        rentalNotes,
        isActive,
      } = req.body;

      const shop = await shopRepository.create({
        shopNameEn,
        shopNameLo,
        ...(locationEn ? { locationEn } : {}),
        ...(locationLo ? { locationLo } : {}),
        ...(descriptionEn ? { descriptionEn } : {}),
        ...(descriptionLo ? { descriptionLo } : {}),
        ...(vendorName ? { vendorName } : {}),
        ...(vendorPhone ? { vendorPhone } : {}),
        ...(rentalBillingType ? { rentalBillingType } : {}),
        ...(rentalAmount !== undefined ? { rentalAmount } : {}),
        ...(rentalNotes ? { rentalNotes } : {}),
        ...(isActive !== undefined ? { isActive } : {}),
      });

      res.status(201).json({ success: true, data: { shop } });
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const {
        shopNameEn,
        shopNameLo,
        locationEn,
        locationLo,
        descriptionEn,
        descriptionLo,
        vendorName,
        vendorPhone,
        rentalBillingType,
        rentalAmount,
        rentalNotes,
        isActive,
      } = req.body;

      const data: any = {};
      if (shopNameEn !== undefined) data.shopNameEn = shopNameEn;
      if (shopNameLo !== undefined) data.shopNameLo = shopNameLo;
      if (locationEn !== undefined) data.locationEn = locationEn;
      if (locationLo !== undefined) data.locationLo = locationLo;
      if (descriptionEn !== undefined) data.descriptionEn = descriptionEn;
      if (descriptionLo !== undefined) data.descriptionLo = descriptionLo;
      if (vendorName !== undefined) data.vendorName = vendorName;
      if (vendorPhone !== undefined) data.vendorPhone = vendorPhone;
      if (rentalBillingType !== undefined) data.rentalBillingType = rentalBillingType;
      if (rentalAmount !== undefined) data.rentalAmount = rentalAmount;
      if (rentalNotes !== undefined) data.rentalNotes = rentalNotes;
      if (isActive !== undefined) data.isActive = isActive;

      const shop = await shopRepository.update(id, data);
      res.json({ success: true, data: { shop } });
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const { id } = req.params;
      await shopRepository.delete(id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  // ─── Shop Rentals / Fees ─────────────────────────────────
  async listRentals(req, res, next) {
    try {
      const { shopId, academicYear, status, page = 1, limit = 50 } = req.query;
      const result = await shopRepository.listRentalPayments({
        shopId: shopId || req.params.id,
        academicYear,
        status,
        page: parseInt(page),
        limit: parseInt(limit),
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async createRental(req, res, next) {
    try {
      const shopId = req.params.id;
      const payment = await shopRepository.createRentalPayment(shopId, req.body);
      res.status(201).json({ success: true, data: { payment } });
    } catch (error) {
      next(error);
    }
  }

  async recordPayment(req, res, next) {
    try {
      const { rentalId } = req.params;
      const payment = await shopRepository.recordRentalPayment(rentalId, req.body);
      res.json({ success: true, data: { payment } });
    } catch (error) {
      next(error);
    }
  }

  async uploadSlip(req, res, next) {
    let saved: string | null = null;
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No slip file uploaded' });
      }
      const existing = await shopRepository.findRentalPaymentById(req.params.rentalId);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Rental payment record not found' });
      }

      saved = await saveSlip(req.file.buffer);
      const updated = await shopRepository.setRentalSlip(existing.rentalPaymentId, saved);
      if (existing.slipUrl) {
        await removePhoto(existing.slipUrl);
      }
      res.json({ success: true, data: { payment: updated } });
    } catch (error) {
      if (saved) await removePhoto(saved);
      next(error);
    }
  }

  async deleteSlip(req, res, next) {
    try {
      const existing = await shopRepository.findRentalPaymentById(req.params.rentalId);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Rental payment record not found' });
      }
      const updated = await shopRepository.setRentalSlip(existing.rentalPaymentId, null);
      if (existing.slipUrl) {
        await removePhoto(existing.slipUrl);
      }
      res.json({ success: true, data: { payment: updated } });
    } catch (error) {
      next(error);
    }
  }

  async deleteRental(req, res, next) {
    try {
      const { rentalId } = req.params;
      await shopRepository.deleteRentalPayment(rentalId);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }
}

export default new ShopController();
