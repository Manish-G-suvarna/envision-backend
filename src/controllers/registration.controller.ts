import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { emitRegistrationUpdate, emitNewRegistration } from '../utils/socketUtils';
import { parse } from 'csv-parse/sync';
import fs from 'fs';

export const createRegistration = async (req: Request, res: Response) => {
    try {
        const { clerkId, eventIds, teams, totalAmount } = req.body;

        if (!clerkId || !Array.isArray(eventIds) || eventIds.length === 0) {
            console.error('Registration validation failed: Missing clerkId or eventIds', { clerkId, eventIds });
            return res.status(400).json({ error: 'Missing registration details (ID or Events)' });
        }

        const user = await prisma.user.findUnique({ where: { clerkId } });
        if (!user) {
            console.error('Registration failed: User not in database', { clerkId });
            return res.status(404).json({ error: 'User profile not found. Please complete onboarding.' });
        }

        // Ensure totalAmount is a safe integer
        const amount = Math.round(Number(totalAmount)) || 0;

        // Atomic transaction to create registration, events, and members
        const registration = await prisma.registration.create({
            data: {
                user_id: user.id,
                total_amount: amount,
                events: {
                    create: eventIds.map((eventId: number) => {
                        const teamData = teams?.[eventId] || teams?.[String(eventId)];
                        console.log(`Processing event ${eventId}, found teamData:`, !!teamData);
                        return {
                            event_id: eventId,
                            team_name: teamData?.teamName || null,
                            members: {
                                create: teamData?.members?.map((m: any) => ({
                                    env_id: m.envId,
                                    name: m.name,
                                    is_leader: m.isLeader || false,
                                    user_id: m.userId || null
                                })) || [{
                                    env_id: user.env_id || `ENV-TEMP-${user.id}`,
                                    name: user.name,
                                    is_leader: true,
                                    user_id: user.id
                                }]
                            }
                        };
                    })
                }
            },
            include: {
                events: {
                    include: {
                        event: true,
                        members: true
                    }
                }
            }
        });

        res.status(201).json(registration);
        
        // Notify admin is now moved to verifyPayment (after UTR is provided)
    } catch (error) {
        console.error('CRITICAL: Error creating registration:', error);
        res.status(500).json({ 
            error: 'Database error while creating registration', 
            details: error instanceof Error ? error.message : 'Unknown error' 
        });
    }
};

export const getRegistration = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const registration = await prisma.registration.findUnique({
            where: { id: parseInt(id) },
            include: {
                events: {
                    include: {
                        event: true,
                        members: true
                    }
                }
            }
        });

        if (!registration) return res.status(404).json({ error: 'Registration not found' });
        res.json(registration);
    } catch (error) {
        console.error('Error fetching registration:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

export const verifyPayment = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { utrId } = req.body;

        if (!utrId) return res.status(400).json({ error: 'UTR ID is required' });

        const regId = parseInt(id);

        // -- UTR REUSE CHECK --
        const existingUtr = await prisma.registration.findUnique({
            where: { utr_id: utrId }
        });

        if (existingUtr && existingUtr.id !== regId) {
            return res.status(400).json({ 
                error: 'This UTR ID has already been used for another registration. Please provide a valid, unique transaction ID.' 
            });
        }

        const registration = await prisma.registration.findUnique({
            where: { id: regId }
        });

        if (!registration) return res.status(404).json({ error: 'Registration not found' });

        // -- PRE-VERIFICATION CHECK --
        const preVerified = await (prisma as any).verifiedTransaction.findUnique({
            where: { utr_id: utrId }
        });

        let finalStatus = 'pending';
        let isInstantSuccess = false;

        if (preVerified && !preVerified.processed) {
            const regAmount = Number(registration.total_amount);
            const verifiedAmount = Number(preVerified.amount);

            if (Math.abs(regAmount - verifiedAmount) < 0.5) {
                finalStatus = 'verified';
                isInstantSuccess = true;

                await (prisma as any).verifiedTransaction.update({
                    where: { id: preVerified.id },
                    data: { processed: true }
                });
            }
        }

        const updated = await prisma.registration.update({
            where: { id: regId },
            data: {
                utr_id: utrId,
                payment_status: finalStatus
            },
            include: {
                user: true, // Needed for admin dashboard
                events: {
                    include: {
                        event: true,
                        members: true
                    }
                }
            }
        });

        res.json({ 
            success: true, 
            registration: updated,
            instantVerification: isInstantSuccess 
        });

        // NOTIFY ADMIN: This is the first time they see the registration
        emitNewRegistration(updated);
        emitRegistrationUpdate(updated.id, finalStatus);
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ error: 'Failed to update payment status' });
    }
};

export const createRegistrationWithPayment = async (req: Request, res: Response) => {
    try {
        console.log('🚀 ATOMIC REGISTRATION INITIATED');
        console.log('Payload:', JSON.stringify(req.body, null, 2));

        const { clerkId, eventIds, teams, totalAmount, utrId } = req.body;

        if (!clerkId || !Array.isArray(eventIds) || eventIds.length === 0 || !utrId) {
            console.error('Atomic registration validation failed:', { clerkId, eventIds, utrId });
            return res.status(400).json({ error: 'Missing registration details or UTR ID' });
        }

        const user = await prisma.user.findUnique({ where: { clerkId } });
        if (!user) {
            console.error('Atomic registration failed: User not in database', { clerkId });
            return res.status(404).json({ error: 'User profile not found. Please complete onboarding.' });
        }

        // 1. UTR REUSE CHECK
        const existingUtr = await prisma.registration.findUnique({
            where: { utr_id: utrId }
        });
        if (existingUtr) {
            return res.status(400).json({ error: 'This UTR ID has already been used for another registration.' });
        }

        // 2. PRE-VERIFICATION CHECK
        const preVerified = await (prisma as any).verifiedTransaction.findUnique({
            where: { utr_id: utrId }
        });

        let finalStatus = 'pending';
        let isInstantSuccess = false;
        const amount = Math.round(Number(totalAmount)) || 0;

        if (preVerified && !preVerified.processed) {
            const verifiedAmount = Number(preVerified.amount);
            if (Math.abs(amount - verifiedAmount) < 0.5) {
                finalStatus = 'verified';
                isInstantSuccess = true;
                await (prisma as any).verifiedTransaction.update({
                    where: { id: preVerified.id },
                    data: { processed: true }
                });
            }
        }

        // 3. ATOMIC CREATION
        const registration = await prisma.registration.create({
            data: {
                user_id: user.id,
                total_amount: amount,
                utr_id: utrId,
                payment_status: finalStatus,
                events: {
                    create: eventIds.map((eventId: number) => {
                        const teamData = teams?.[eventId] || teams?.[String(eventId)];
                        const rawTeamName = teamData?.teamName || null;
                        const sanitizedTeamName = (typeof rawTeamName === 'string' && rawTeamName.trim() === '') ? null : rawTeamName;

                        return {
                            event_id: eventId,
                            team_name: sanitizedTeamName,
                            members: {
                                create: teamData?.members?.map((m: any) => ({
                                    env_id: m.envId,
                                    name: m.name,
                                    is_leader: m.isLeader || false,
                                    user_id: m.userId || null
                                })) || [{
                                    env_id: user.env_id || `ENV-TEMP-${user.id}`,
                                    name: user.name,
                                    is_leader: true,
                                    user_id: user.id
                                }]
                            }
                        };
                    })
                }
            },
            include: {
                user: true,
                events: {
                    include: {
                        event: true,
                        members: true
                    }
                }
            }
        });

        res.status(201).json({
            success: true,
            registration,
            instantVerification: isInstantSuccess
        });

        // NOTIFY ADMIN
        emitNewRegistration(registration);
        if (isInstantSuccess) {
            emitRegistrationUpdate(registration.id, finalStatus);
        }

    } catch (error) {
        console.error('CRITICAL: Error in atomic registration creation:', error);
        res.status(500).json({ 
            error: 'Database error while creating registration', 
            details: error instanceof Error ? error.message : 'Unknown error' 
        });
    }
};

export const bulkUpdateRegistrations = async (req: Request, res: Response) => {
    try {
        let updates = [];

        // Check if it's a file upload (from CSV Sender App)
        if (req.file) {
            const fileContent = fs.readFileSync(req.file.path, 'utf8');
            const records = parse(fileContent, {
                columns: true,
                skip_empty_lines: true,
                trim: true
            });
            
            // Map CSV columns (handle different possible names)
            updates = records.map((r: any) => ({
                utrId: r.utr_id || r.utrId || r.UTR || r.TransactionID || r['utr id'] || r['UTR ID'],
                amount: r.amount || r.Amount || r['Amount Paid'],
                status: r.status || r.Status || 'completed'
            }));

            console.log(`📊 Received ${updates.length} updates via CSV:`);
            console.table(updates.slice(0, 5)); // Log first 5 for verification

            // Clean up temporary file
            fs.unlinkSync(req.file.path);
        } else {
            // Fallback to JSON updates array
            updates = req.body.updates || [];
        }

        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ error: 'No valid updates found' });
        }

        const results = {
            updated: [] as any[],
            mismatch: [] as any[],
            notFound: [] as any[]
        };

        for (const update of updates) {
            const { utrId, status, amount } = update;
            if (!utrId || !status) continue;

            const registration = await prisma.registration.findUnique({
                where: { utr_id: utrId.toString() }
            });

            if (registration) {
                // Verify amount (handling the Decimal type)
                const regAmount = Number(registration.total_amount);
                const csvAmount = Number(amount);
                
                // Allow a small margin (0.5 for rounding)
                if (csvAmount && Math.abs(regAmount - csvAmount) > 0.5) {
                    console.warn(`❌ Amount mismatch for UTR ${utrId}: DB=${regAmount}, CSV=${csvAmount}`);
                    results.mismatch.push({ utrId, regAmount, csvAmount });
                    continue;
                }

                const updated = await prisma.registration.update({
                    where: { id: registration.id },
                    data: { payment_status: status.toLowerCase() }
                });
                
                results.updated.push(updated);
                emitRegistrationUpdate(updated.id, status.toLowerCase());
            } else {
                // -- PRE-VERIFICATION LOGGING --
                // Save to VerifiedTransaction for future user claim
                try {
                    await (prisma as any).verifiedTransaction.upsert({
                        where: { utr_id: utrId.toString() },
                        update: { 
                            amount: Number(amount),
                            status: status.toLowerCase()
                        },
                        create: {
                            utr_id: utrId.toString(),
                            amount: Number(amount),
                            status: status.toLowerCase()
                        }
                    });
                    results.notFound.push(`${utrId} (Stored for pre-verification)`);
                } catch (err) {
                    console.error(`Failed to store pre-verified UTR ${utrId}:`, err);
                    results.notFound.push(utrId);
                }
            }
        }

        console.log('✅ Bulk update processing complete.');
        console.log(`📊 Summary: Updated=${results.updated.length}, Mismatched=${results.mismatch.length}, Not Found=${results.notFound.length}`);
        
        // Notify admin to refresh dashboard
        emitNewRegistration({ summary: results });

        res.json({ 
            success: true, 
            summary: {
                totalProcessed: updates.length,
                updatedCount: results.updated.length,
                mismatchCount: results.mismatch.length,
                notFoundCount: results.notFound.length
            },
            details: results
        });
    } catch (error) {
        console.error('Error in bulk update:', error);
        res.status(500).json({ error: 'Bulk update failed', details: error instanceof Error ? error.message : 'Unknown error' });
    }
};

export const joinTeam = async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;
        const { clerkId, inviteFrom } = req.body;

        if (!clerkId || !inviteFrom || !eventId) {
            return res.status(400).json({ error: 'Missing join details (clerkId, inviteFrom, or eventId)' });
        }

        // 1. Find the joining user
        const joiner = await prisma.user.findUnique({ where: { clerkId } });
        if (!joiner) return res.status(404).json({ error: 'Joining user not found' });

        // 2. Find the leader/inviter (by ENV ID or Clerk ID)
        const leader = await prisma.user.findFirst({
            where: {
                OR: [
                    { env_id: inviteFrom },
                    { clerkId: inviteFrom }
                ]
            }
        });

        if (!leader) return res.status(404).json({ error: 'Inviter user not found' });

        // 3. Find the RegistrationEvent owned by the leader for this eventId
        const regEvent = await prisma.registrationEvent.findFirst({
            where: {
                event_id: parseInt(eventId),
                registration: {
                    user_id: leader.id
                }
            },
            include: {
                registration: true,
                members: true
            }
        });

        if (!regEvent) {
            return res.status(404).json({ error: 'No active team registration found for this event by the specified inviter.' });
        }

        // 4. Check if joiner is already a member
        const alreadyMember = regEvent.members.some(m => 
            m.user_id === joiner.id || (joiner.env_id && m.env_id === joiner.env_id)
        );

        if (alreadyMember) {
            return res.status(400).json({ error: 'You are already a member of this team.' });
        }

        // 5. Add the member
        const newMember = await prisma.registrationMember.create({
            data: {
                registration_event_id: regEvent.id,
                user_id: joiner.id,
                env_id: joiner.env_id || `ENV-JOIN-${joiner.id}`,
                name: joiner.name,
                is_leader: false
            }
        });

        // 6. Refetch complete registration for socket update
        const updatedReg = await prisma.registration.findUnique({
            where: { id: regEvent.registration_id },
            include: {
                user: true,
                events: {
                    include: {
                        event: true,
                        members: true
                    }
                }
            }
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
                college: true
            }
        });

        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (error) {
        console.error('Error looking up user by ENV ID:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};
