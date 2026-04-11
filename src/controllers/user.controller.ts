import { Request, Response } from 'express';
import prisma from '../config/prisma';

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
        const { clerkId, email, name, college, department, usn, phone, gender, degree, year } = req.body;
        
        if (!clerkId || !email || !name || !college || !department || !usn || !year) {
            return res.status(400).json({ error: 'Missing required onboarding fields' });
        }


        // Use upsert in case Clerk already logged them but broke midway
        const user = await prisma.user.upsert({
            where: { clerkId },
            update: {
                name,
                usn,
                college,
                department,
                phone,
                gender,
                degree,
                year,
                is_onboarded: true
            },
            create: {
                clerkId,
                email,
                name,
                usn,
                college,
                department,
                phone,
                gender,
                degree,
                year,
                is_onboarded: true
            }
        });

        // Generate ENV ID if not present
        if (!user.env_id) {
            const envId = `ENV-${user.id.toString().padStart(6, '0')}`;
            await prisma.user.update({
                where: { id: user.id },
                data: { env_id: envId }
            });
            user.env_id = envId;
        }

        res.status(201).json(user);
    } catch (error) {
        console.error('Error onboarding user:', error);
        res.status(500).json({ error: 'Failed to onboard user', details: error instanceof Error ? error.message : 'Unknown error' });
    }

};

export const getProfile = async (req: Request, res: Response) => {
    try {
        const { clerkId } = req.params;
        
        // 1. Fetch user by clerkId
        const user = await prisma.user.findUnique({
            where: { clerkId }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // 2. Fetch OWNED registrations with members
        const ownedRegistrations = await prisma.registration.findMany({
            where: { user_id: user.id },
            include: {
                events: {
                    include: {
                        event: true,
                        members: true
                    }
                }
            },
            orderBy: {
                created_at: 'desc'
            }
        });

        // 3. Fetch JOINED registrations (where user is a member but not the owner)
        // We look for RegistrationMember records matching this user's env_id or user_id
        const memberships = await prisma.registrationMember.findMany({
            where: {
                OR: [
                    { user_id: user.id },
                    { env_id: user.env_id || '' }
                ],
                is_leader: false // Leaders already see it in ownedRegistrations
            },
            include: {
                registration_event: {
                    include: {
                        registration: {
                            include: {
                                user: true, // Include the leader name
                                events: {
                                    include: {
                                        event: true,
                                        members: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        // Extract the unique registrations from memberships
        const joinedRegistrations: any[] = [];
        const seenRegIds = new Set(ownedRegistrations.map(r => r.id));

        memberships.forEach(m => {
            const reg = m.registration_event?.registration;
            if (reg && !seenRegIds.has(reg.id)) {
                joinedRegistrations.push(reg);
                seenRegIds.add(reg.id);
            }
        });

        // Combine both
        const allRegistrations = [...ownedRegistrations, ...joinedRegistrations].sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        // Prepare the response
        const fullProfile = {
            ...user,
            registrations: allRegistrations
        };

        res.json(fullProfile);
    } catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
