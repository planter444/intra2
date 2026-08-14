const notFound = (req, res, next) => {
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });
};

const errorHandler = (error, req, res, next) => {
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal server error';

  // Always log errors in production for debugging
  console.error('Error handler caught:', {
    statusCode,
    message,
    path: req.path,
    method: req.method,
    error: error.message,
    stack: error.stack
  });

  if (error.code === '23505') {
    statusCode = 400;

    if (['users_email_key', 'idx_users_email_active_unique'].includes(error.constraint)) {
      message = 'A user with this email already exists.';
    }

    if (['users_employee_no_key', 'idx_users_employee_no_active_unique'].includes(error.constraint)) {
      message = 'A user with this employee number already exists.';
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    console.error(error);
  }

  res.status(statusCode).json({
    message,
    stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
  });
};

module.exports = {
  notFound,
  errorHandler
};
