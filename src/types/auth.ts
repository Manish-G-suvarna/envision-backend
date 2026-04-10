import { Request } from 'express';

export type AdminRequestContext = {
    id: number;
    clerkUserId?: string;
    email: string;
    name: string;
    isActive: boolean;
    scope: 'main' | 'department';
    departments: string[];
};

export type AuthenticatedRequest = Request & {
    admin?: AdminRequestContext;
    authUserId?: string;
};
