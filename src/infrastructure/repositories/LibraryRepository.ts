import prisma from '../database/PrismaClient';
import { schoolDateValue, addDays } from '../../domain/schoolTime';
import dispatcher from '../notifications/NotificationDispatcher';

/** How many times one loan may be extended. */
const MAX_RENEWALS = 2;

export class LibraryRepository {
  // ─── Categories ────────────────────────────────────────
  async listCategories() {
    return prisma.bookCategory.findMany({
      orderBy: { nameEn: 'asc' },
      include: {
        _count: { select: { books: true } },
      },
    });
  }

  async createCategory(data: { nameEn: string; nameLo: string }) {
    return prisma.bookCategory.create({
      data,
    });
  }

  async updateCategory(categoryId: number, data: { nameEn?: string; nameLo?: string }) {
    return prisma.bookCategory.update({ where: { categoryId }, data });
  }

  // Books in a deleted category keep existing, uncategorised (onDelete: SetNull).
  async deleteCategory(categoryId: number) {
    return prisma.bookCategory.delete({ where: { categoryId } });
  }

  // One student's loans, open ones first, for the parent portal. "overdue" is worked out from the due date.
  async getStudentLoans(studentId: number) {
    const loans = await prisma.bookLoan.findMany({
      where: { studentId },
      orderBy: [{ returnedDate: { sort: 'desc', nulls: 'first' } }, { borrowedDate: 'desc' }],
      take: 50,
      include: { book: { select: { titleEn: true, titleLo: true, author: true, coverUrl: true } } },
    });
    const now = new Date();
    return loans.map((l) => ({
      ...l,
      status: !l.returnedDate && l.status !== 'lost' && l.dueDate < now ? 'overdue' : l.status,
    }));
  }

  // ─── Books ─────────────────────────────────────────────
  async listBooks(query: {
    search?: string;
    categoryId?: number;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.status) where.status = query.status;

    if (query.search) {
      where.OR = [
        { titleEn: { contains: query.search } },
        { titleLo: { contains: query.search } },
        { isbn: { contains: query.search } },
        { author: { contains: query.search } },
        { shelfLocation: { contains: query.search } },
      ];
    }

    const [total, books] = await Promise.all([
      prisma.book.count({ where }),
      prisma.book.findMany({
        where,
        skip,
        take: limit,
        orderBy: { titleEn: 'asc' },
        include: {
          category: true,
          _count: {
            select: {
              loans: { where: { status: 'borrowed' } },
            },
          },
        },
      }),
    ]);

    return {
      books,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getBook(bookId: number) {
    return prisma.book.findUnique({
      where: { bookId },
      include: {
        category: true,
        loans: {
          where: { status: 'borrowed' },
          include: {
            student: {
              select: {
                studentId: true,
                studentCode: true,
                fullNameEn: true,
                fullNameLo: true,
              },
            },
          },
        },
      },
    });
  }

  async createBook(data: {
    isbn?: string;
    titleEn: string;
    titleLo: string;
    author: string;
    publisher?: string;
    publishYear?: number;
    categoryId?: number;
    shelfLocation?: string;
    totalCopies?: number;
    coverUrl?: string;
  }) {
    const totalCopies = data.totalCopies ?? 1;
    return prisma.book.create({
      data: {
        isbn: data.isbn,
        titleEn: data.titleEn,
        titleLo: data.titleLo,
        author: data.author,
        publisher: data.publisher,
        publishYear: data.publishYear,
        categoryId: data.categoryId,
        shelfLocation: data.shelfLocation,
        totalCopies,
        availableCopies: totalCopies,
        coverUrl: data.coverUrl,
        status: totalCopies > 0 ? 'available' : 'out_of_stock',
      },
      include: { category: true },
    });
  }

  async updateBook(
    bookId: number,
    data: {
      isbn?: string;
      titleEn?: string;
      titleLo?: string;
      author?: string;
      publisher?: string;
      publishYear?: number;
      categoryId?: number;
      shelfLocation?: string;
      totalCopies?: number;
      availableCopies?: number;
      coverUrl?: string;
      status?: string;
    }
  ) {
    // Copies out on loan stay out: a new total moves the available count by the same amount.
    if (data.totalCopies !== undefined) {
      const book = await prisma.book.findUnique({ where: { bookId } });
      if (!book) throw Object.assign(new Error('Book not found'), { statusCode: 404 });
      const onLoan = book.totalCopies - book.availableCopies;
      if (data.totalCopies < onLoan) {
        throw Object.assign(new Error(`${onLoan} copies are on loan; the total cannot be lower than that`), { statusCode: 409 });
      }
      data.availableCopies = data.totalCopies - onLoan;
      if (book.status !== 'archived') data.status = data.availableCopies > 0 ? 'available' : 'out_of_stock';
    }
    return prisma.book.update({
      where: { bookId },
      data,
      include: { category: true },
    });
  }

  async deleteBook(bookId: number) {
    return prisma.book.delete({
      where: { bookId },
    });
  }

  // ─── Borrow / Checkout (Card Tap supported) ────────────
  async borrowBook(params: {
    cardUid?: string;
    studentId?: number;
    bookId: number;
    days?: number;
    processedBy?: number;
    notes?: string;
  }) {
    let studentId = params.studentId;

    if (!studentId && params.cardUid) {
      const card = await prisma.card.findUnique({
        where: { cardUid: params.cardUid },
        select: { studentId: true, status: true },
      });
      if (!card) {
        throw Object.assign(new Error('Card not found'), { statusCode: 404 });
      }
      if (card.status !== 'active') {
        throw Object.assign(new Error(`Card is ${card.status}`), { statusCode: 409 });
      }
      studentId = card.studentId;
    }

    if (!studentId) {
      throw Object.assign(new Error('Student ID or active Card UID is required'), { statusCode: 400 });
    }

    const [book, student] = await Promise.all([
      prisma.book.findUnique({ where: { bookId: params.bookId } }),
      prisma.student.findUnique({ where: { studentId } }),
    ]);

    if (!book) {
      throw Object.assign(new Error('Book not found'), { statusCode: 404 });
    }
    if (book.availableCopies < 1) {
      throw Object.assign(new Error('No copies available for borrowing'), { statusCode: 409 });
    }
    if (!student) {
      throw Object.assign(new Error('Student not found'), { statusCode: 404 });
    }

    const loanDays = params.days ?? 14;
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + loanDays);

    const [loan] = await prisma.$transaction([
      prisma.bookLoan.create({
        data: {
          bookId: book.bookId,
          studentId: student.studentId,
          borrowedDate: new Date(),
          dueDate,
          status: 'borrowed',
          processedBy: params.processedBy,
          notes: params.notes,
        },
        include: {
          book: true,
          student: true,
        },
      }),
      prisma.book.update({
        where: { bookId: book.bookId },
        data: {
          availableCopies: { decrement: 1 },
          status: book.availableCopies - 1 > 0 ? 'available' : 'out_of_stock',
        },
      }),
    ]);

    // Notify parents
    const dueStr = dueDate.toLocaleDateString('en-GB');
    const msgEn = `📚 Library: ${student.fullNameEn} borrowed "${book.titleEn}". Due date: ${dueStr}.`;
    const msgLo = `📚 ຫ້ອງສະໝຸດ: ນ້ອງ ${student.fullNameLo} ໄດ້ຢືມປຶ້ມ "${book.titleLo || book.titleEn}". ກຳນົດສົ່ງ: ${dueStr}.`;

    dispatcher.notifyParents(
      student.studentId,
      'library',
      msgEn,
      msgLo
    ).catch((err) => console.error('[Library] Parent notification error:', err));

    return loan;
  }

  // ─── Return Book ───────────────────────────────────────
  /**
   * Extends an open loan by `days` from today or its current due date, whichever is later
   * (so an overdue book is renewed from today). No fines are charged. At most MAX_RENEWALS.
   */
  async renewLoan(loanId: number, days = 14) {
    const loan = await prisma.bookLoan.findUnique({ where: { loanId } });
    if (!loan) throw Object.assign(new Error('Loan record not found'), { statusCode: 404 });
    if (loan.returnedDate || loan.status === 'returned' || loan.status === 'lost') {
      throw Object.assign(new Error('Only a book that is still out can be renewed'), { statusCode: 409 });
    }
    if (loan.renewCount >= MAX_RENEWALS) {
      throw Object.assign(new Error(`This loan has already been renewed ${MAX_RENEWALS} times`), { statusCode: 409 });
    }
    const today = schoolDateValue();
    const from = loan.dueDate > today ? loan.dueDate : today;
    return prisma.bookLoan.update({
      where: { loanId },
      data: { dueDate: addDays(from, days), renewCount: { increment: 1 }, status: 'borrowed' },
      include: { book: true, student: true },
    });
  }

  async returnBook(loanId: number, notes?: string) {
    const loan = await prisma.bookLoan.findUnique({
      where: { loanId },
      include: { book: true, student: true },
    });

    if (!loan) {
      throw Object.assign(new Error('Loan record not found'), { statusCode: 404 });
    }
    if (loan.status === 'returned') {
      throw Object.assign(new Error('This book has already been returned'), { statusCode: 409 });
    }

    const [updatedLoan] = await prisma.$transaction([
      prisma.bookLoan.update({
        where: { loanId },
        data: {
          status: 'returned',
          returnedDate: new Date(),
          notes: notes || loan.notes,
        },
        include: { book: true, student: true },
      }),
      prisma.book.update({
        where: { bookId: loan.bookId },
        data: {
          availableCopies: { increment: 1 },
          status: 'available',
        },
      }),
    ]);

    return updatedLoan;
  }

  // ─── List Loans ────────────────────────────────────────
  async listLoans(query: {
    studentId?: number;
    bookId?: number;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.studentId) where.studentId = query.studentId;
    if (query.bookId) where.bookId = query.bookId;

    if (query.status === 'overdue') {
      where.status = 'borrowed';
      where.dueDate = { lt: new Date() };
    } else if (query.status) {
      where.status = query.status;
    }

    if (query.search) {
      where.OR = [
        { book: { titleEn: { contains: query.search } } },
        { book: { titleLo: { contains: query.search } } },
        { student: { fullNameEn: { contains: query.search } } },
        { student: { fullNameLo: { contains: query.search } } },
        { student: { studentCode: { contains: query.search } } },
      ];
    }

    const [total, loans] = await Promise.all([
      prisma.bookLoan.count({ where }),
      prisma.bookLoan.findMany({
        where,
        skip,
        take: limit,
        orderBy: { borrowedDate: 'desc' },
        include: {
          book: true,
          student: {
            select: {
              studentId: true,
              studentCode: true,
              fullNameEn: true,
              fullNameLo: true,
              cards: { where: { status: 'active' }, select: { cardUid: true } },
              classStudents: {
                select: { class: { select: { classNameEn: true, classNameLo: true } } },
              },
            },
          },
          processor: {
            select: { userId: true, fullNameEn: true, fullNameLo: true },
          },
        },
      }),
    ]);

    const now = new Date();
    const enrichedLoans = loans.map((l) => {
      const isOverdue = l.status === 'borrowed' && new Date(l.dueDate) < now;
      return {
        ...l,
        isOverdue,
      };
    });

    return {
      loans: enrichedLoans,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getOverview() {
    const now = new Date();
    const [totalBooks, totalCopies, activeLoans, overdueLoans, totalCategories] = await Promise.all([
      prisma.book.count(),
      prisma.book.aggregate({ _sum: { totalCopies: true } }),
      prisma.bookLoan.count({ where: { status: 'borrowed' } }),
      prisma.bookLoan.count({ where: { status: 'borrowed', dueDate: { lt: now } } }),
      prisma.bookCategory.count(),
    ]);

    return {
      totalTitles: totalBooks,
      totalCopies: totalCopies._sum.totalCopies || 0,
      activeLoans,
      overdueLoans,
      totalCategories,
    };
  }
}

export default new LibraryRepository();
