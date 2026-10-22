import expenseRepository from '../../infrastructure/repositories/ExpenseRepository';
import { saveSlip, removePhoto } from '../../infrastructure/storage/PhotoStorage';

class ExpenseController {
  // ─── Categories ──────────────────────────────────────────
  async listCategories(req: any, res: any, next: any) {
    try {
      const includeInactive = req.query.includeInactive === 'true';
      const categories = await expenseRepository.listCategories(includeInactive);
      res.json({ success: true, data: { categories } });
    } catch (error) {
      next(error);
    }
  }

  async createCategory(req: any, res: any, next: any) {
    try {
      const category = await expenseRepository.createCategory(req.body);
      res.status(201).json({ success: true, data: { category } });
    } catch (error) {
      next(error);
    }
  }

  async updateCategory(req: any, res: any, next: any) {
    try {
      const categoryId = parseInt(req.params.id, 10);
      const category = await expenseRepository.updateCategory(categoryId, req.body);
      res.json({ success: true, data: { category } });
    } catch (error) {
      next(error);
    }
  }

  async deleteCategory(req: any, res: any, next: any) {
    try {
      const categoryId = parseInt(req.params.id, 10);
      await expenseRepository.deleteCategory(categoryId);
      res.json({ success: true, message: 'Expense category deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // ─── Expenses ────────────────────────────────────────────
  async listExpenses(req: any, res: any, next: any) {
    try {
      const {
        search = '',
        categoryId,
        academicYear,
        startDate,
        endDate,
        page = 1,
        limit = 20,
      } = req.query;

      const result = await expenseRepository.listExpenses({
        search: String(search || ''),
        categoryId: categoryId ? parseInt(String(categoryId), 10) : undefined,
        academicYear: academicYear ? String(academicYear) : undefined,
        startDate: startDate ? String(startDate) : undefined,
        endDate: endDate ? String(endDate) : undefined,
        page: parseInt(String(page), 10) || 1,
        limit: parseInt(String(limit), 10) || 20,
      });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getExpense(req: any, res: any, next: any) {
    try {
      const expenseId = parseInt(req.params.id, 10);
      const expense = await expenseRepository.getExpense(expenseId);
      if (!expense) {
        return res.status(404).json({ success: false, message: 'Expense not found' });
      }
      res.json({ success: true, data: { expense } });
    } catch (error) {
      next(error);
    }
  }

  async createExpense(req: any, res: any, next: any) {
    try {
      const recordedBy = req.user?.userId;
      const expense = await expenseRepository.createExpense(req.body, recordedBy);
      res.status(201).json({ success: true, data: { expense } });
    } catch (error) {
      next(error);
    }
  }

  async updateExpense(req: any, res: any, next: any) {
    try {
      const expenseId = parseInt(req.params.id, 10);
      const expense = await expenseRepository.updateExpense(expenseId, req.body);
      res.json({ success: true, data: { expense } });
    } catch (error) {
      next(error);
    }
  }

  async deleteExpense(req: any, res: any, next: any) {
    try {
      const expenseId = parseInt(req.params.id, 10);
      const existing = await expenseRepository.getExpense(expenseId);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Expense not found' });
      }
      if (existing.receiptUrl) {
        await removePhoto(existing.receiptUrl);
      }
      await expenseRepository.deleteExpense(expenseId);
      res.json({ success: true, message: 'Expense deleted successfully' });
    } catch (error) {
      next(error);
    }
  }

  // ─── Receipt / Slip Upload ───────────────────────────────
  async uploadReceipt(req: any, res: any, next: any) {
    let saved: string | null = null;
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No receipt file uploaded' });
      }

      const expenseId = parseInt(req.params.id, 10);
      const existing = await expenseRepository.getExpense(expenseId);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Expense not found' });
      }

      saved = await saveSlip(req.file.buffer);
      await expenseRepository.setExpenseReceipt(expenseId, saved);

      if (existing.receiptUrl) {
        await removePhoto(existing.receiptUrl);
      }

      const updated = await expenseRepository.getExpense(expenseId);
      res.json({ success: true, data: { expense: updated } });
    } catch (error) {
      if (saved) await removePhoto(saved);
      next(error);
    }
  }

  async deleteReceipt(req: any, res: any, next: any) {
    try {
      const expenseId = parseInt(req.params.id, 10);
      const existing = await expenseRepository.getExpense(expenseId);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Expense not found' });
      }

      if (existing.receiptUrl) {
        await removePhoto(existing.receiptUrl);
        await expenseRepository.setExpenseReceipt(expenseId, null);
      }

      const updated = await expenseRepository.getExpense(expenseId);
      res.json({ success: true, data: { expense: updated } });
    } catch (error) {
      next(error);
    }
  }
}

export default new ExpenseController();
