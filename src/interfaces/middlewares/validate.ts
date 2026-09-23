import { ZodSchema } from 'zod';

/**
 * Validates req.body against a zod schema before the request reaches the
 * controller/use-case. On failure, responds 400 with a field-level error list
 * instead of letting bad input reach the database layer.
 *
 * Usage: router.post('/foo', validate(fooSchema), controller.create)
 */
const validate = (schema: ZodSchema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
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
    // Replace req.body with the parsed/coerced data (e.g. string "10" -> number 10)
    req.body = result.data;
    next();
  };
};

export default validate;
