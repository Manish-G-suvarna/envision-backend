import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

export const validateRequest = (schema: ZodSchema) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Validate and strip extra fields based on the schema
            const validated = await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });

            // Replace req data with the validated and sanitized data
            req.body = (validated as any).body;

            Object.defineProperty(req, 'query', {
                value: (validated as any).query,
                writable: true,
                configurable: true
            });
            Object.defineProperty(req, 'params', {
                value: (validated as any).params,
                writable: true,
                configurable: true
            });

            next();
        } catch (error) {
            console.error("VALIDATION MIDDLEWARE ERROR:", error);
            if (error instanceof ZodError) {
                res.status(400).json({
                    message: 'Validation failed',
                    errors: error.issues
                });
                return;
            }
            res.status(500).json({ error: (error as Error).message, stack: (error as Error).stack });
        }
    };
};
