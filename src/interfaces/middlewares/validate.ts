import { ZodSchema } from 'zod';

/**
 * Validates req.body against a zod schema before the request reaches the
 * controller/use-case. On failure, responds 400 with a field-level error list
 * instead of letting bad input reach the database layer.
 *
 * Usage: router.post('/foo', validate(fooSchema), controller.create)
 *        router.get('/foo', validate(fooQuerySchema, 'query'), controller.list)
 */
const validate = (schema: ZodSchema, source: 'body' | 'query' = 'body') => {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: result.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    // Replace req.body with the parsed/coerced data (e.g. string "10" -> number 10).
    // req.query is read-only in Express 5, so query params are validated but not replaced.
    if (source === 'body') req.body = result.data;
    next();
  };
};

export default validate;
