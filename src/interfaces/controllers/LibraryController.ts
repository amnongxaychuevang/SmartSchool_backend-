import libraryRepository from '../../infrastructure/repositories/LibraryRepository';

class LibraryController {
  // Categories
  async listCategories(req: any, res: any, next: any) {
    try {
      const categories = await libraryRepository.listCategories();
      res.json({ success: true, data: { categories } });
    } catch (error) {
      next(error);
    }
  }

  async createCategory(req: any, res: any, next: any) {
    try {
      const category = await libraryRepository.createCategory(req.body);
      res.status(201).json({ success: true, data: { category } });
    } catch (error) {
      next(error);
    }
  }

  async updateCategory(req: any, res: any, next: any) {
    try {
      const category = await libraryRepository.updateCategory(Number(req.params.id), req.body);
      res.json({ success: true, data: { category } });
    } catch (error) {
      next(error);
    }
  }

  async deleteCategory(req: any, res: any, next: any) {
    try {
      await libraryRepository.deleteCategory(Number(req.params.id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  // Books
  async listBooks(req: any, res: any, next: any) {
    try {
      const { search, categoryId, status, page, limit } = req.query;
      const result = await libraryRepository.listBooks({
        search,
        categoryId: categoryId ? Number(categoryId) : undefined,
        status,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getBook(req: any, res: any, next: any) {
    try {
      const { id } = req.params;
      const book = await libraryRepository.getBook(Number(id));
      if (!book) {
        return res.status(404).json({ success: false, message: 'Book not found' });
      }
      res.json({ success: true, data: { book } });
    } catch (error) {
      next(error);
    }
  }

  async createBook(req: any, res: any, next: any) {
    try {
      const book = await libraryRepository.createBook(req.body);
      res.status(201).json({ success: true, data: { book } });
    } catch (error) {
      next(error);
    }
  }

  async updateBook(req: any, res: any, next: any) {
    try {
      const { id } = req.params;
      const book = await libraryRepository.updateBook(Number(id), req.body);
      res.json({ success: true, data: { book } });
    } catch (error) {
      next(error);
    }
  }

  async deleteBook(req: any, res: any, next: any) {
    try {
      const { id } = req.params;
      await libraryRepository.deleteBook(Number(id));
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  // Borrow / Return
  async borrowBook(req: any, res: any, next: any) {
    try {
      const loan = await libraryRepository.borrowBook({
        ...req.body,
        processedBy: req.user?.userId,
      });
      res.status(201).json({ success: true, data: { loan } });
    } catch (error) {
      next(error);
    }
  }

  async renewLoan(req: any, res: any, next: any) {
    try {
      const days = Math.min(30, Math.max(1, parseInt(req.body?.days) || 14));
      const loan = await libraryRepository.renewLoan(Number(req.params.loanId), days);
      res.json({ success: true, data: { loan } });
    } catch (error) {
      next(error);
    }
  }

  async returnBook(req: any, res: any, next: any) {
    try {
      const { loanId } = req.params;
      const loan = await libraryRepository.returnBook(Number(loanId), req.body.notes);
      res.json({ success: true, data: { loan } });
    } catch (error) {
      next(error);
    }
  }

  async listLoans(req: any, res: any, next: any) {
    try {
      const { studentId, bookId, status, search, page, limit } = req.query;
      const result = await libraryRepository.listLoans({
        studentId: studentId ? Number(studentId) : undefined,
        bookId: bookId ? Number(bookId) : undefined,
        status,
        search,
        page: page ? Number(page) : undefined,
        limit: limit ? Number(limit) : undefined,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async getOverview(req: any, res: any, next: any) {
    try {
      const overview = await libraryRepository.getOverview();
      res.json({ success: true, data: overview });
    } catch (error) {
      next(error);
    }
  }
}

export default new LibraryController();
