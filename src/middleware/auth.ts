import { Response, NextFunction } from 'express';
import { getAuth } from '@clerk/express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../types/auth';
import { resolveAdminScope } from '../utils/adminScope';

export const requireUserAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    try {
        const auth: any = getAuth(req as any);
        const userId = auth?.userId;

        if (!userId) {
            res.status(401).json({ message: 'Unauthorized - Sign in required' });
            return;
        }

        req.authUserId = userId;
        next();
    } catch (error) {
        console.error('Error verifying user auth:', error);
        res.status(500).json({ message: 'Error verifying user session' });
    }
};

export const verifyAdmin = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
        // 1. Try Manual JWT Token first (for our custom login)
        const request = req as any;
        const authHeader = request.headers?.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            try {
                const decoded = jwt.verify(token, env.ADMIN_JWT_SECRET) as any;
                const admin = await prisma.admin.findUnique({
                    where: { id: decoded.id },
                    select: { id: true, email: true, name: true, is_active: true }
                });

                if (admin && admin.is_active) {
                    const scopeInfo = resolveAdminScope(admin.email);
                    req.admin = {
                        id: admin.id,
                        email: admin.email,
                        name: admin.name,
                        isActive: admin.is_active,
                        scope: scopeInfo.scope,
                        departments: scopeInfo.departments,
                    };
                    return next();
                }
            } catch (err) {
                // Token invalid, fallback to Clerk
            }
        }

        // 2. Fallback to Clerk Auth
        // Clerk expect a standard Request, we cast to any to satisfy the complex union
        const auth: any = getAuth(req as any);
        const userId = auth?.userId;

        if (userId) {
            const admin = await prisma.admin.findUnique({
                where: { clerk_user_id: userId },
                select: {
                    id: true,
                    clerk_user_id: true,
                    email: true,
                    name: true,
                    is_active: true,
                },
            });

            if (admin && admin.is_active) {
                const scopeInfo = resolveAdminScope(admin.email);
                req.admin = {
                    id: admin.id,
                    clerkUserId: admin.clerk_user_id || undefined,
                    email: admin.email,
                    name: admin.name,
                    isActive: admin.is_active,
                    scope: scopeInfo.scope,
                    departments: scopeInfo.departments,
                };
                return next();
            }
        }

        res.status(401).json({ message: 'Unauthorized - Invalid Admin Session' });
    } catch (error) {
        console.error('Error verifying admin:', error);
        res.status(500).json({ message: 'Error verifying admin access' });
    }
};

export const requireMainAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.admin) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }

    if (req.admin.scope !== 'main') {
        res.status(403).json({ message: 'Only main admin can access this resource' });
        return;
    }

    next();
};
