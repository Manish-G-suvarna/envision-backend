import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import prisma from '../config/prisma';

const formatEnvId = (id: number) => `ENV-${id.toString().padStart(3, '0')}`;

export const checkUser = async (req: Request, res: Response) => {
    try {
        const { clerkId } = req.body;
        if (!clerkId) {
            return res.status(400).json({ error: 'clerkId is required' });
        }

        const user = await prisma.user.findUnique({
            where: { clerkId }
        });

        if (!user) {
            return res.json({ exists: false, isOnboarded: false });
        }

        res.json({ exists: true, isOnboarded: user.is_onboarded });
    } catch (error) {
        console.error('Error checking user:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const onboardUser = async (req: Request, res: Response) => {
    try {
        const clerkId = req.body.clerkId?.trim();
        const email = req.body.email?.trim().toLowerCase();
        const name = req.body.name?.trim();
        const college = req.body.college?.trim();
        const department = req.body.department?.trim();
        const usn = req.body.usn?.trim().toUpperCase();
        const phone = req.body.phone?.trim() || null;
        const gender = req.body.gender?.trim() || null;
        const degree = req.body.degree?.trim() || null;
        const branch = req.body.branch?.trim() || null;
        const year = req.body.year?.trim() || null;
        
        if (!clerkId || !email || !name || !college || !department || !usn) {
            return res.status(400).json({ error: 'Missing required onboarding fields' });
        }

        const existingUsnUser = await prisma.user.findUnique({
            where: { usn }
        });

        if (existingUsnUser && existingUsnUser.clerkId !== clerkId && existingUsnUser.email !== email) {
            return res.status(409).json({
                error: 'A user with this USN already exists',
                details: 'This USN is already linked to another account. Please verify the number or contact support.',
            });
        }

        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [
                    { clerkId },
                    { email }
                ]
            }
        });

        const userData = {
            clerkId,
            email,
            name,
            usn,
            college,
            department,
            phone,
            gender,
            degree,
            branch,
            year,
            is_onboarded: true
        };

        const user = existingUser
            ? await prisma.user.update({
                where: { id: existingUser.id },
                data: userData
            })
            : await prisma.user.create({
                data: userData
            });

        // Generate ENV ID if not present
        if (!user.env_id) {
            const envId = formatEnvId(user.id);
            await prisma.user.update({
                where: { id: user.id },
                data: { env_id: envId }
            });
            user.env_id = envId;
        }

        res.status(201).json(user);
    } catch (error) {
        console.error('Error onboarding user:', error);

        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const target = Array.isArray(error.meta?.target) ? error.meta.target[0] : error.meta?.target;
            const field = typeof target === 'string' ? target : 'record';
            const fieldLabels: Record<string, string> = {
                email: 'email',
                usn: 'USN',
                env_id: 'ENV ID',
                clerkId: 'account',
            };
            const label = fieldLabels[field] || field;

            return res.status(409).json({
                error: `A user with this ${label} already exists`,
                details: `The ${label} is already linked to another account. Please use a different value or clean up the existing record.`,
            });
        }

        res.status(500).json({ error: 'Failed to onboard user', details: error instanceof Error ? error.message : 'Unknown error' });
    }

};

export const getProfile = async (req: Request, res: Response) => {
    try {
        const { clerkId } = req.params;
        
        const user = await prisma.user.findUnique({
            where: { clerkId },
            include: {
                registrations: {
                    include: {
                        events: {
                            include: {
                                event: true
                            }
                        }
                    },
                    orderBy: {
                        created_at: 'desc'
                    }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
