import { z } from 'zod';

const passwordSchema = z.string().min(8).max(128);

export const bootstrapAdminSchema = z.object({
    body: z.object({
        email: z.string().email(),
        name: z.string().min(2).max(80),
        password: passwordSchema,
    }),
});

export const loginAdminSchema = z.object({
    body: z.object({
        email: z.string().email(),
        password: z.string().min(1),
    }),
});

export const changeOwnPasswordSchema = z.object({
    body: z.object({
        currentPassword: z.string().min(1),
        newPassword: passwordSchema,
    }),
});
