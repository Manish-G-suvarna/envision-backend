import { z } from 'zod';

export const idParamSchema = z.object({
    params: z.object({
        id: z.string().regex(/^\d+$/).transform(Number),
    }),
});

export const updateEventStatusSchema = z.object({
    params: z.object({
        id: z.string().regex(/^\d+$/).transform(Number),
    }),
    body: z.object({
        status: z.enum(['OPEN', 'CLOSED']),
    }),
});

export const listEventsSchema = z.object({
    query: z.object({
        page: z.string().regex(/^\d+$/).transform(Number).optional(),
        limit: z.string().regex(/^\d+$/).transform(Number).optional(),
        search: z.string().max(100).optional(),
    }).passthrough(),
});
