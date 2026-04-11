import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { emitRegistrationUpdate, emitNewRegistration } from '../utils/socketUtils';
import { parse } from 'csv-parse/sync';
import fs from 'fs';
import { AuthenticatedRequest } from '../types/auth';

const SUCCESS_PAYMENT_STATUSES = new Set(['verified', 'completed', 'paid']);

function normalizeUtr(value: unknown): string {
    return String(value ?? '').trim();
}

function normalizePaymentStatus(value: unknown): string {
    return String(value ?? '').trim().toLowerCase();
}

function isSuccessfulPaymentStatus(status: string): boolean {
    return SUCCESS_PAYMENT_STATUSES.has(status);
}

function buildRegistrationEventCreates(eventIds: number[], teams: any, user: { id: number; env_id: string | null; name: string }) {
    return eventIds.map((eventId: number) => {
        const teamData = teams?.[eventId] || teams?.[String(eventId)];
        const rawTeamName = teamData?.teamName || null;
        const sanitizedTeamName = typeof rawTeamName === 'string' && rawTeamName.trim() === '' ? null : rawTeamName;

        return {
            event_id: eventId,
            team_name: sanitizedTeamName,
            members: {
                create:
                    teamData?.members?.map((member: any) => ({
                        env_id: member.envId,
                        name: member.name,
                        is_leader: member.isLeader || false,
                        user_id: member.userId || null,
                    })) || [
                        {
                            env_id: user.env_id || `ENV-TEMP-${user.id}`,
                            name: user.name,
                            is_leader: true,
                            user_id: user.id,
                        },
                    ],
            },
        };
    });
}

async function getAuthenticatedUser(req: AuthenticatedRequest, res: Response) {
    const clerkId = req.authUserId;
    if (!clerkId) {
        res.status(401).json({ error: 'Unauthorized - Sign in required' });
        return null;
    }

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) {
        res.status(404).json({ error: 'User profile not found. Please complete onboarding.' });
        return null;
    }

    return user;
}

export const createRegistration = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { eventIds, teams, totalAmount } = req.body;

        if (!Array.isArray(eventIds) || eventIds.length === 0) {
            console.error('Registration validation failed: Missing eventIds', { eventIds });
            return res.status(400).json({ error: 'Missing registration details (events)' });
        }

        const user = await getAuthenticatedUser(req, res);
        if (!user) return;

        const amount = Math.round(Number(totalAmount)) || 0;

        const registration = await prisma.registration.create({
            data: {
                user_id: user.id,
                total_amount: amount,
                events: {
                    create: buildRegistrationEventCreates(eventIds, teams, user),
                },
            },
            include: {
                events: {
                    include: {
                        event: true,
                        members: true,
                    },
                },
            },
        });

        res.status(201).json(registration);
    } catch (error) {
        console.error('CRITICAL: Error creating registration:', error);
        res.status(500).json({
            error: 'Database error while creating registration',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

export const getRegistration = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const authReq = req as AuthenticatedRequest;
        const user = await getAuthenticatedUser(authReq, res);
        if (!user) return;

        const registration = await prisma.registration.findUnique({
            where: { id: parseInt(id) },
            include: {
                user: {
                    select: {
                        id: true,
                    },
                },
                events: {
                    include: {
                        event: true,
                        members: true,
                    },
                },
            },
        });

        if (!registration) return res.status(404).json({ error: 'Registration not found' });
        if (registration.user_id !== user.id) {
            return res.status(403).json({ error: 'Forbidden - You can only access your own registration' });
        }
        res.json(registration);
    } catch (error) {
        console.error('Error fetching registration:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const verifyPayment = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const normalizedUtr = normalizeUtr(req.body?.utrId);

        if (!normalizedUtr) return res.status(400).json({ error: 'UTR ID is required' });
        const user = await getAuthenticatedUser(req, res);
        if (!user) return;

        const regId = parseInt(id);

        const { updated, isInstantSuccess, finalStatus } = await prisma.$transaction(async (tx) => {
            const registration = await tx.registration.findUnique({
                where: { id: regId },
            });

            if (!registration) {
                throw new Error('REGISTRATION_NOT_FOUND');
            }

            if (registration.user_id !== user.id) {
                throw new Error('FORBIDDEN_REGISTRATION_ACCESS');
            }

            if (registration.utr_id && registration.utr_id !== normalizedUtr) {
                throw new Error('UTR_IMMUTABLE');
            }

            const existingUtr = await tx.registration.findUnique({
                where: { utr_id: normalizedUtr },
            });

            if (existingUtr && existingUtr.id !== regId) {
                throw new Error('UTR_ALREADY_USED');
            }

            const preVerified = await (tx as any).verifiedTransaction.findUnique({
                where: { utr_id: normalizedUtr },
            });

            let nextStatus = 'pending';
            let instantVerification = false;

            if (preVerified && !preVerified.processed) {
                const regAmount = Number(registration.total_amount);
                const verifiedAmount = Number(preVerified.amount);

                if (Math.abs(regAmount - verifiedAmount) < 0.5) {
                    nextStatus = 'verified';
                    instantVerification = true;
                }
            }

            const updatedRegistration = await tx.registration.update({
                where: { id: regId },
                data: {
                    utr_id: normalizedUtr,
                    payment_status: nextStatus,
                },
                include: {
                    user: true,
                    events: {
                        include: {
                            event: true,
                            members: true,
                        },
                    },
                },
            });

            if (instantVerification) {
                await (tx as any).verifiedTransaction.update({
                    where: { utr_id: normalizedUtr },
                    data: { processed: true },
                });
            }

            return {
                updated: updatedRegistration,
                isInstantSuccess: instantVerification,
                finalStatus: nextStatus,
            };
        });

        res.json({
            success: true,
            registration: updated,
            instantVerification: isInstantSuccess,
        });

        emitNewRegistration(updated);
        emitRegistrationUpdate(updated.id, finalStatus);
    } catch (error) {
        if (error instanceof Error && error.message === 'UTR_ALREADY_USED') {
            return res.status(400).json({
                error: 'This UTR ID has already been used for another registration. Please provide a valid, unique transaction ID.',
            });
        }
        if (error instanceof Error && error.message === 'REGISTRATION_NOT_FOUND') {
            return res.status(404).json({ error: 'Registration not found' });
        }
        if (error instanceof Error && error.message === 'UTR_IMMUTABLE') {
            return res.status(400).json({
                error: 'UTR cannot be changed once set for a registration.',
            });
        }
        if (error instanceof Error && error.message === 'FORBIDDEN_REGISTRATION_ACCESS') {
            return res.status(403).json({ error: 'Forbidden - You can only update your own registration' });
        }
        console.error('Error verifying payment:', error);
        res.status(500).json({ error: 'Failed to update payment status' });
    }
};

export const createRegistrationWithPayment = async (req: AuthenticatedRequest, res: Response) => {
    try {
        console.log('ATOMIC REGISTRATION INITIATED');
        console.log('Payload:', JSON.stringify(req.body, null, 2));

        const { eventIds, teams, totalAmount } = req.body;
        const normalizedUtr = normalizeUtr(req.body?.utrId);

        if (!Array.isArray(eventIds) || eventIds.length === 0 || !normalizedUtr) {
            console.error('Atomic registration validation failed:', { eventIds, utrId: normalizedUtr });
            return res.status(400).json({ error: 'Missing registration details or UTR ID' });
        }

        const user = await getAuthenticatedUser(req, res);
        if (!user) return;

        const amount = Math.round(Number(totalAmount)) || 0;

        const { registration, isInstantSuccess, finalStatus } = await prisma.$transaction(async (tx) => {
            const existingUtr = await tx.registration.findUnique({
                where: { utr_id: normalizedUtr },
            });
            if (existingUtr) {
                throw new Error('UTR_ALREADY_USED');
            }

            const preVerified = await (tx as any).verifiedTransaction.findUnique({
                where: { utr_id: normalizedUtr },
            });

            let nextStatus = 'pending';
            let instantVerification = false;

            if (preVerified && !preVerified.processed) {
                const verifiedAmount = Number(preVerified.amount);
                if (Math.abs(amount - verifiedAmount) < 0.5) {
                    nextStatus = 'verified';
                    instantVerification = true;
                }
            }

            const createdRegistration = await tx.registration.create({
                data: {
                    user_id: user.id,
                    total_amount: amount,
                    utr_id: normalizedUtr,
                    payment_status: nextStatus,
                    events: {
                        create: buildRegistrationEventCreates(eventIds, teams, user),
                    },
                },
                include: {
                    user: true,
                    events: {
                        include: {
                            event: true,
                            members: true,
                        },
                    },
                },
            });

            if (instantVerification) {
                await (tx as any).verifiedTransaction.update({
                    where: { utr_id: normalizedUtr },
                    data: { processed: true },
                });
            }

            return {
                registration: createdRegistration,
                isInstantSuccess: instantVerification,
                finalStatus: nextStatus,
            };
        });

        res.status(201).json({
            success: true,
            registration,
            instantVerification: isInstantSuccess,
        });

        emitNewRegistration(registration);
        if (isInstantSuccess) {
            emitRegistrationUpdate(registration.id, finalStatus);
        }
    } catch (error) {
        if (error instanceof Error && error.message === 'UTR_ALREADY_USED') {
            return res.status(400).json({ error: 'This UTR ID has already been used for another registration.' });
        }
        console.error('CRITICAL: Error in atomic registration creation:', error);
        res.status(500).json({
            error: 'Database error while creating registration',
            details: error instanceof Error ? error.message : 'Unknown error',
        });
    }
};

export const bulkUpdateRegistrations = async (req: Request, res: Response) => {
    try {
        let updates = [];

        if (req.file) {
            const fileContent = fs.readFileSync(req.file.path, 'utf8');
            const records = parse(fileContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true,
            });

            updates = records.map((record: any) => ({
                utrId: record.utr_id || record.utrId || record.UTR || record.TransactionID || record['utr id'] || record['UTR ID'],
                amount: record.amount || record.Amount || record['Amount Paid'],
                status: record.status || record.Status || 'completed',
            }));

            console.log(`Received ${updates.length} updates via CSV.`);
            console.table(updates.slice(0, 5));
            fs.unlinkSync(req.file.path);
        } else {
            updates = req.body.updates || [];
        }

        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ error: 'No valid updates found' });
        }

        const results = {
            updated: [] as any[],
            mismatch: [] as any[],
            notFound: [] as any[],
        };

        for (const update of updates) {
            const normalizedUtr = normalizeUtr(update?.utrId);
            const normalizedStatus = normalizePaymentStatus(update?.status);
            const amount = update?.amount;

            if (!normalizedUtr || !normalizedStatus) continue;

            const registration = await prisma.registration.findUnique({
                where: { utr_id: normalizedUtr },
            });

            if (registration) {
                const regAmount = Number(registration.total_amount);
                const csvAmount = Number(amount);

                if (csvAmount && Math.abs(regAmount - csvAmount) > 0.5) {
                    console.warn(`Amount mismatch for UTR ${normalizedUtr}: DB=${regAmount}, CSV=${csvAmount}`);
                    results.mismatch.push({ utrId: normalizedUtr, regAmount, csvAmount });
                    continue;
                }

                const updated = await prisma.$transaction(async (tx) => {
                    const updatedRegistration = await tx.registration.update({
                        where: { id: registration.id },
                        data: { payment_status: normalizedStatus },
                    });

                    if (isSuccessfulPaymentStatus(normalizedStatus)) {
                        await (tx as any).verifiedTransaction.upsert({
                            where: { utr_id: normalizedUtr },
                            update: {
                                amount: regAmount,
                                status: normalizedStatus,
                                processed: true,
                            },
                            create: {
                                utr_id: normalizedUtr,
                                amount: regAmount,
                                status: normalizedStatus,
                                processed: true,
                            },
                        });
                    }

                    return updatedRegistration;
                });

                results.updated.push(updated);
                emitRegistrationUpdate(updated.id, normalizedStatus);
            } else {
                try {
                    await (prisma as any).verifiedTransaction.upsert({
                        where: { utr_id: normalizedUtr },
                        update: {
                            amount: Number(amount),
                            status: normalizedStatus,
                        },
                        create: {
                            utr_id: normalizedUtr,
                            amount: Number(amount),
                            status: normalizedStatus,
                        },
                    });
                    results.notFound.push(`${normalizedUtr} (Stored for pre-verification)`);
                } catch (error) {
                    console.error(`Failed to store pre-verified UTR ${normalizedUtr}:`, error);
                    results.notFound.push(normalizedUtr);
                }
            }
        }

        console.log('Bulk update processing complete.');
        console.log(`Summary: Updated=${results.updated.length}, Mismatched=${results.mismatch.length}, Not Found=${results.notFound.length}`);

        emitNewRegistration({ summary: results });

        res.json({
            success: true,
            summary: {
                totalProcessed: updates.length,
                updatedCount: results.updated.length,
                mismatchCount: results.mismatch.length,
                notFoundCount: results.notFound.length,
            },
            details: results,
        });
    } catch (error) {
        console.error('Error in bulk update:', error);
        res.status(500).json({ error: 'Bulk update failed', details: error instanceof Error ? error.message : 'Unknown error' });
    }
};

export const joinTeam = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { eventId } = req.params;
        const { inviteFrom } = req.body;

        if (!inviteFrom || !eventId) {
            return res.status(400).json({ error: 'Missing join details (inviteFrom or eventId)' });
        }

        const joiner = await getAuthenticatedUser(req, res);
        if (!joiner) return;

        const leader = await prisma.user.findFirst({
            where: {
                OR: [{ env_id: inviteFrom }, { clerkId: inviteFrom }],
            },
        });

        if (!leader) return res.status(404).json({ error: 'Inviter user not found' });

        const regEvent = await prisma.registrationEvent.findFirst({
            where: {
                event_id: parseInt(eventId),
                registration: {
                    user_id: leader.id,
                },
            },
            include: {
                registration: true,
                members: true,
            },
        });

        if (!regEvent) {
            return res.status(404).json({ error: 'No active team registration found for this event by the specified inviter.' });
        }

        const alreadyMember = regEvent.members.some((member) => member.user_id === joiner.id || (joiner.env_id && member.env_id === joiner.env_id));

        if (alreadyMember) {
            return res.status(400).json({ error: 'You are already a member of this team.' });
        }

        const newMember = await prisma.registrationMember.create({
            data: {
                registration_event_id: regEvent.id,
                user_id: joiner.id,
                env_id: joiner.env_id || `ENV-JOIN-${joiner.id}`,
                name: joiner.name,
                is_leader: false,
            },
        });

        const updatedReg = await prisma.registration.findUnique({
            where: { id: regEvent.registration_id },
            include: {
                user: true,
                events: {
                    include: {
                        event: true,
                        members: true,
                    },
                },
            },
        });

        if (updatedReg) {
            emitRegistrationUpdate(updatedReg.id, updatedReg.payment_status);
        }

        res.status(201).json({ success: true, member: newMember, registration: updatedReg });
    } catch (error) {
        console.error('Error joining team:', error);
        res.status(500).json({ error: 'Internal Server Error', details: error instanceof Error ? error.message : 'Unknown error' });
    }
};

export const getUserByEnvId = async (req: Request, res: Response) => {
    try {
        const { envId } = req.params;
        const user = await prisma.user.findUnique({
            where: { env_id: envId },
            select: {
                id: true,
                name: true,
                env_id: true,
                email: true,
                college: true,
                registrations: {
                    select: {
                        events: {
                            select: {
                                event_id: true,
                            }
                        }
                    }
                }
            },
        });

        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (error) {
        console.error('Error looking up user by ENV ID:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
