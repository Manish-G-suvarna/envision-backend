import { z } from 'zod';

export const listParticipantsSchema = z.object({
    query: z.object({
        eventId: z.string().regex(/^\d+$/).transform(Number).optional(),
        status: z.string().optional(),
        page: z.string().regex(/^\d+$/).transform(Number).optional(),
        limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    }).passthrough(),
});

export const getParticipantByIdSchema = z.object({
    params: z.object({
        id: z.string().regex(/^\d+$/).transform(Number),
    }),
});

export const updatePaymentStatusSchema = z.object({
    params: z.object({
        id: z.string().regex(/^\d+$/).transform(Number),
    }),
    body: z.object({
        payment_status: z.enum(['pending', 'verified', 'rejected']),
    }),
});

export const removeParticipantSchema = z.object({
    params: z.object({
        id: z.string().regex(/^\d+$/).transform(Number),
    }),
});
