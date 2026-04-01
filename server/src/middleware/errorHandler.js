// Patterns that indicate a raw database error message that may leak schema details
const DB_ERROR_PATTERNS = [
  /relation\s+"[^"]+"\s+does not exist/i,
  /column\s+"[^"]+"\s+of\s+relation/i,
  /violates\s+(foreign key|unique|not-null|check)\s+constraint/i,
  /duplicate key value violates/i,
  /null value in column/i,
  /invalid input syntax for type/i,
  /operator does not exist/i,
  /function\s+\w+\([^)]*\)\s+does not exist/i,
];

function isSensitiveDbError(message) {
  return DB_ERROR_PATTERNS.some((re) => re.test(message));
}

export function errorHandler(err, _req, res, _next) {
  const isProduction = process.env.NODE_ENV === 'production';

  // Always log the full error server-side for debugging
  console.error('Unhandled error:', err);

  const status = err.status || err.statusCode || 500;
  const rawMessage = err.message || 'Internal server error';

  // In production, replace messages that leak database schema details with a generic message
  const safeMessage =
    isProduction && isSensitiveDbError(rawMessage)
      ? 'An internal error occurred. Please try again later.'
      : rawMessage;

  res.status(status).json({
    error: safeMessage,
    ...(isProduction ? {} : { stack: err.stack }),
  });
}
