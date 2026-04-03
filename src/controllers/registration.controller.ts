import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { emitRegistrationUpdate, emitNewRegistration } from '../utils/socketUtils';
import { parse } from 'csv-parse/sync';
import fs from 'fs';

const MAX_EVENTS_PER_USER = 4;

export const createRegistration = async (req: Request, res: Response) => {
    try {
        const { clerkId, eventIds, teams } = req.body;

        if (!clerkId || !Array.isArray(eventIds) || eventIds.length === 0) {
            console.error('Registration validation failed: Missing clerkId or eventIds', { clerkId, eventIds });
            return res.status(400).json({ error: 'Missing registration details (ID or Events)' });
        }

        const user = await prisma.user.findUnique({ where: { clerkId } });
        if (!user) {
            console.error('Registration failed: User not in database', { clerkId });
            return res.status(404).json({ error: 'User profile not found. Please complete onboarding.' });
        }

        const requestedEventIds = [...new Set(eventIds.map((eventId: number) => Number(eventId)).filter(Boolean))];

        if (requestedEventIds.length === 0) {
            return res.status(400).json({ error: 'No valid events were selected' });
        }

        const selectedEvents = await prisma.event.findMany({
            where: {
                id: { in: requestedEventIds }
            },
            select: {
                id: true,
                fee: true,
                event_name: true,
                is_team_event: true,
                team_min_size: true,
                team_max_size: true,
            }
        });

        if (selectedEvents.length !== requestedEventIds.length) {
            return res.status(400).json({ error: 'One or more selected events were not found' });
        }

        const existingRegistrationEvents = await prisma.registrationEvent.findMany({
            where: {
                registration: {
                    user_id: user.id,
                },
            },
            select: {
                event_id: true,
                event: {
                    select: {
                        event_name: true,
                    },
                },
            },
        });

        const existingEventIds = new Set(existingRegistrationEvents.map((entry) => entry.event_id));
        const duplicateSelectedEvents = requestedEventIds
            .filter((eventId) => existingEventIds.has(eventId))
            .map((eventId) => existingRegistrationEvents.find((entry) => entry.event_id === eventId)?.event.event_name || `Event ${eventId}`);

        if (duplicateSelectedEvents.length > 0) {
            return res.status(400).json({
                error: `Already registered for: ${duplicateSelectedEvents.join(', ')}`
            });
        }

        const totalJoinedEvents = new Set([...existingEventIds, ...requestedEventIds]).size;

        if (totalJoinedEvents > MAX_EVENTS_PER_USER) {
            return res.status(400).json({
                error: `You can join a maximum of ${MAX_EVENTS_PER_USER} events. You already have ${existingEventIds.size}, so you can only add ${Math.max(MAX_EVENTS_PER_USER - existingEventIds.size, 0)} more.`
            });
        }

        const eventConfigById = new Map(selectedEvents.map(event => [event.id, event]));

        for (const rawEventId of requestedEventIds) {
            const eventId = Number(rawEventId);
            const eventConfig = eventConfigById.get(eventId);

            if (!eventConfig?.is_team_event) {
                continue;
            }

            const teamData = teams?.[eventId] || teams?.[String(eventId)];
            const memberCount = Array.isArray(teamData?.members) ? teamData.members.length : 0;
            const minSize = eventConfig.team_min_size ?? 1;
            const maxSize = eventConfig.team_max_size ?? minSize;

            if (teamData && memberCount > 0 && (memberCount < minSize || memberCount > maxSize)) {
                return res.status(400).json({
                    error: `${eventConfig.event_name} requires ${minSize === maxSize ? `${minSize}` : `${minSize}-${maxSize}`} team members`
                });
            }
        }

        const amount = selectedEvents.reduce((sum, event) => sum + Number(event.fee || 0), 0);

        // Atomic transaction to create registration, events, and members
        const registration = await prisma.registration.create({
            data: {
                user_id: user.id,
                total_amount: amount,
                events: {
                    create: requestedEventIds.map((eventId: number) => {
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
        
        // Notify admin in real-time
        emitNewRegistration(registration);
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
        const registration = await prisma.registration.findUnique({
            where: { id: regId }
        });

        if (!registration) return res.status(404).json({ error: 'Registration not found' });

        // -- PRE-VERIFICATION CHECK --
        // Check if this UTR was already uploaded by admin via CSV
        const preVerified = await (prisma as any).verifiedTransaction.findUnique({
            where: { utr_id: utrId }
        });

        let finalStatus = 'pending';
        let isInstantSuccess = false;

        if (preVerified && !preVerified.processed) {
            const regAmount = Number(registration.total_amount);
            const verifiedAmount = Number(preVerified.amount);

            // Match UTR + Amount
            if (Math.abs(regAmount - verifiedAmount) < 0.5) {
                finalStatus = 'verified';
                isInstantSuccess = true;

                // Mark transaction as processed
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
            }
        });

        res.json({ 
            success: true, 
            registration: updated,
            instantVerification: isInstantSuccess 
        });

        // Real-time update
        emitRegistrationUpdate(updated.id, finalStatus);
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({ error: 'Failed to update payment status' });
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
