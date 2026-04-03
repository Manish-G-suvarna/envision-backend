import { Response, NextFunction } from 'express';
import { authenticateRequest, clerkClient, getAuth } from '@clerk/express';
import { verifyToken } from '@clerk/backend';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import prisma from '../config/prisma';
import { AuthenticatedRequest } from '../types/auth';

const deriveClerkIssuer = () => {
    if (!env.CLERK_PUBLISHABLE_KEY) return undefined;

    const encoded = env.CLERK_PUBLISHABLE_KEY.split('_').slice(2).join('_');
    if (!encoded) return undefined;

    try {
        const frontendApi = Buffer.from(encoded, 'base64').toString('utf8').replace(/\$$/, '');
        return frontendApi ? `https://${frontendApi}` : undefined;
    } catch {
        return undefined;
    }
};

const clerkIssuer = deriveClerkIssuer();

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
                    req.admin = {
                        id: admin.id,
                        email: admin.email,
                        name: admin.name,
                        isActive: admin.is_active,
                    };
                    return next();
                }
            } catch (err) {
                try {
                    const clerkClaims = await verifyToken(token, {
                        secretKey: env.CLERK_SECRET_KEY,
                        issuer: clerkIssuer || '',
                    });

                    const clerkUserId =
                        typeof clerkClaims.sub === 'string' ? clerkClaims.sub : null;

                    if (clerkUserId) {
                        let admin = await prisma.admin.findUnique({
                            where: { clerk_user_id: clerkUserId },
                            select: {
                                id: true,
                                clerk_user_id: true,
                                email: true,
                                name: true,
                                is_active: true,
                            },
                        });

                        if (!admin) {
                            const clerkUser = await clerkClient.users.getUser(clerkUserId);
                            const primaryEmail =
                                clerkUser.emailAddresses.find(
                                    (email) => email.id === clerkUser.primaryEmailAddressId,
                                )?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress;

                            if (primaryEmail) {
                                const existingAdmin = await prisma.admin.findUnique({
                                    where: { email: primaryEmail.toLowerCase() },
                                    select: {
                                        id: true,
                                        clerk_user_id: true,
                                        email: true,
                                        name: true,
                                        is_active: true,
                                    },
                                });

                                if (existingAdmin) {
                                    if (!existingAdmin.clerk_user_id) {
                                        admin = await prisma.admin.update({
                                            where: { id: existingAdmin.id },
                                            data: { clerk_user_id: clerkUserId },
                                            select: {
                                                id: true,
                                                clerk_user_id: true,
                                                email: true,
                                                name: true,
                                                is_active: true,
                                            },
                                        });
                                    } else {
                                        admin = existingAdmin;
                                    }
                                }
                            }
                        }

                        if (admin && admin.is_active) {
                            req.admin = {
                                id: admin.id,
                                clerkUserId: admin.clerk_user_id || undefined,
                                email: admin.email,
                                name: admin.name,
                                isActive: admin.is_active,
                            };
                            return next();
                        }
                    }
                } catch {
                    // Not a valid Clerk token either; continue with other fallbacks.
                }
            }
        }

        // 2. Fallback to Clerk Auth
        // Clerk auth lookup can throw when no Clerk context/session exists.
        let userId: string | null = null;
        try {
            const auth: any = getAuth(req as any);
            userId = auth?.userId || null;
        } catch {
            userId = null;
        }

        if (!userId) {
            try {
                const requestState = await authenticateRequest({
                    clerkClient,
                    request: req as any,
                });
                const auth = requestState.toAuth();
                userId = auth?.userId || null;
            } catch {
                userId = null;
            }
        }

        if (userId) {
            let admin = await prisma.admin.findUnique({
                where: { clerk_user_id: userId },
                select: {
                    id: true,
                    clerk_user_id: true,
                    email: true,
                    name: true,
                    is_active: true,
                },
            });

            if (!admin) {
                const clerkUser = await clerkClient.users.getUser(userId);
                const primaryEmail =
                    clerkUser.emailAddresses.find(
                        (email) => email.id === clerkUser.primaryEmailAddressId,
                    )?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress;

                if (primaryEmail) {
                    const existingAdmin = await prisma.admin.findUnique({
                        where: { email: primaryEmail.toLowerCase() },
                        select: {
                            id: true,
                            clerk_user_id: true,
                            email: true,
                            name: true,
                            is_active: true,
                        },
                    });

                    if (existingAdmin) {
                        if (!existingAdmin.clerk_user_id) {
                            admin = await prisma.admin.update({
                                where: { id: existingAdmin.id },
                                data: { clerk_user_id: userId },
                                select: {
                                    id: true,
                                    clerk_user_id: true,
                                    email: true,
                                    name: true,
                                    is_active: true,
                                },
                            });
                        } else {
                            admin = existingAdmin;
                        }
                    }
                }
            }

            if (admin && admin.is_active) {
                req.admin = {
                    id: admin.id,
                    clerkUserId: admin.clerk_user_id || undefined,
                    email: admin.email,
                    name: admin.name,
                    isActive: admin.is_active,
                };
                return next();
            }
        }

        res.status(401).json({ message: 'Unauthorized - Invalid Admin Session' });
    } catch (error) {
        console.error('Error verifying admin:', error);
        res.status(401).json({ message: 'Unauthorized - Invalid Admin Session' });
    }
};
