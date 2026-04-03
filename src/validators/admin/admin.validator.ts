import { z } from 'zod';

const idParamSchema = z.object({
    params: z.object({
        id: z.string().regex(/^\d+$/).transform(Number),
    }),
});

const passwordSchema = z.string().min(8).max(128);

export const listAdminsSchema = z.object({
    query: z.object({
        page: z.string().regex(/^\d+$/).transform(Number).optional(),
        limit: z.string().regex(/^\d+$/).transform(Number).optional(),
        search: z.string().max(100).optional(),
        isActive: z.enum(['true', 'false']).optional(),
    }).passthrough(),
});

export const createAdminSchema = z.object({
    body: z.object({
        email: z.string().email(),
        name: z.string().min(2).max(80),
        password: passwordSchema,
    }),
});

export const updateAdminStatusSchema = idParamSchema.extend({
    body: z.object({
        is_active: z.boolean(),
    }),
});

export const resetAdminPasswordSchema = idParamSchema.extend({
    body: z.object({
        password: passwordSchema,
    }),
});

export const deleteAdminSchema = idParamSchema;
