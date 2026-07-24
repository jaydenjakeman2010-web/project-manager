/**
 * Returns Express middleware that validates req.body against a Zod schema.
 * Usage: router.post('/path', validate(createProjectSchema), handler)
 */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      return res.status(422).json({
        error: 'Validation failed',
        fields: errors,
      });
    }
    req.validatedBody = result.data;
    next();
  };
}
