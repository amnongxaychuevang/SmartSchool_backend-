const ErrorHandler = (err, req, res, next) => {
  console.error('[Error]:', err.message || err);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Handle Prisma Unique Constraint Error
  if (err.code === 'P2002') {
    statusCode = 409; // Conflict
    const target = err.meta && err.meta.target ? err.meta.target : 'field';

    if (target.includes('email')) {
      message = 'This email already exists';
    } else if (target.includes('phone_number')) {
      message = 'This phone number already exists';
    } else {
      message = 'Record already exists';
    }
  } else if (err.code === 'P2025') {
    // Handle Prisma Record Not Found Error
    statusCode = 404; // Not Found
    message = 'Record not found in the database';
  } else if (err.code === 'P2003') {
    // Handle Prisma Foreign Key Constraint Error (e.g. deleting a record still
    // referenced elsewhere) — without this, the raw Prisma message (which names
    // internal column/table names) was passed straight through to the client.
    statusCode = 409; // Conflict
    message = 'This record cannot be removed because it is still referenced by other data';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

export default ErrorHandler;
