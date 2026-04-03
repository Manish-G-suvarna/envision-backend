import { z } from 'zod';

export const getEventsQuerySchema = z.object({
    query: z.object({
        search: z.string().max(100).optional(),
        category: z.string().max(50).optional(),
        page: z.string().regex(/^\d+$/).transform(Number).optional(),
        limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    }).passthrough()
});
