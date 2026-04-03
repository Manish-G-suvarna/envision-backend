import { z } from 'zod';

export const dashboardStatsSchema = z.object({
    query: z.object({}).passthrough(),
});

export const getAllStudentsSchema = z.object({
    query: z.object({
        eventId: z.string().regex(/^\d+$/).transform(Number).optional(),
        page: z.string().regex(/^\d+$/).transform(Number).optional(),
        limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    }).passthrough(),
});

export const getAllPaymentsSchema = z.object({
    query: z.object({
        status: z.string().optional(),
        page: z.string().regex(/^\d+$/).transform(Number).optional(),
        limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    }).passthrough(),
});
