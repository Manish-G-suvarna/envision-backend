import { Request, Response } from 'express';
import prisma from '../../config/prisma';

export const listEvents = async (req: Request, res: Response) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 100;
        const search = req.query.search as string | undefined;
        const skip = (page - 1) * limit;

        const whereClause = search ? {
            event_name: { contains: search, mode: 'insensitive' as any },
        } : {};

        const events = await prisma.event.findMany({
            where: whereClause,
            skip,
            take: limit,
            include: {
                department: true,
                _count: {
                    select: { registrations: true },
                },
            },
            orderBy: { created_at: 'asc' },
        });

        const total = await prisma.event.count({ where: whereClause });

        // Revenue from registrations
        const formattedEvents = await Promise.all(
            events.map(async (event) => {
                const [approvedCount, pendingCount, rejectedCount, revenue] = await Promise.all([
                    prisma.registration.count({
                        where: {
                            payment_status: { in: ['verified', 'completed'] },
                            events: { some: { event_id: event.id } },
                        },
                    }),
                    prisma.registration.count({
                        where: {
                            payment_status: 'pending',
                            events: { some: { event_id: event.id } },
                        },
                    }),
                    prisma.registration.count({
                        where: {
                            payment_status: { in: ['rejected', 'failed'] },
                            events: { some: { event_id: event.id } },
                        },
                    }),
                    prisma.registration.aggregate({
                        _sum: { total_amount: true },
                        where: {
                            payment_status: { in: ['verified', 'completed'] },
                            events: { some: { event_id: event.id } },
                        },
                    }),
                ]);

                return {
                    id: event.id,
                    event_name: event.event_name,
                    department: event.department.department_name,
                    fee: Number(event.fee),
                    event_type: event.event_type,
                    status: event.status,
                    is_mega_event: event.is_mega_event,
                    _count: { registrations: approvedCount },
                    statusCounts: {
                        approved: approvedCount,
                        pending: pendingCount,
                        rejected: rejectedCount,
                    },
                    collectedAmount: Number(revenue._sum.total_amount || 0),
                    created_at: event.created_at,
                };
            })
        );

        res.json({
            data: formattedEvents,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error('Error listing events:', error);
        res.status(500).json({ message: 'Error listing events' });
    }
};

export const getEventById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const event = await prisma.event.findUnique({
            where: { id: Number(id) },
            include: {
                department: true,
                _count: { select: { registrations: true } },
            },
        });

        if (!event) {
            res.status(404).json({ message: 'Event not found' });
            return;
        }

        const revenue = await prisma.registration.aggregate({
            _sum: { total_amount: true },
            where: {
                payment_status: 'verified',
                events: { some: { event_id: event.id } },
            },
        });

        res.json({
            id: event.id,
            event_name: event.event_name,
            description: event.description,
            department: event.department.department_name,
            fee: Number(event.fee),
            event_type: event.event_type,
            status: event.status,
            is_mega_event: event.is_mega_event,
            _count: { registrations: event._count.registrations },
            collectedAmount: Number(revenue._sum.total_amount || 0),
            created_at: event.created_at,
        });
    } catch (error) {
        console.error('Error fetching event:', error);
        res.status(500).json({ message: 'Error fetching event' });
    }
};

export const getEventStats = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const event = await prisma.event.findUnique({ where: { id: Number(id) } });
        if (!event) {
            res.status(404).json({ message: 'Event not found' });
            return;
        }

        const [total, verified, pending, revenue] = await Promise.all([
            prisma.registrationEvent.count({ where: { event_id: event.id } }),
            prisma.registration.count({
                where: { payment_status: 'verified', events: { some: { event_id: event.id } } },
            }),
            prisma.registration.count({
                where: { payment_status: 'pending', events: { some: { event_id: event.id } } },
            }),
            prisma.registration.aggregate({
                _sum: { total_amount: true },
                where: { payment_status: 'verified', events: { some: { event_id: event.id } } },
            }),
        ]);

        res.json({
            eventId: event.id,
            eventName: event.event_name,
            status: event.status,
            participantCount: total,
            collectedAmount: Number(revenue._sum.total_amount || 0),
            verifiedPayments: verified,
            pendingPayments: pending,
        });
    } catch (error) {
        console.error('Error fetching event stats:', error);
        res.status(500).json({ message: 'Error fetching event stats' });
    }
};

export const getEventRegistrationDetails = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const eventId = Number(id);

        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: {
                department: true,
            },
        });

        if (!event) {
            res.status(404).json({ message: 'Event not found' });
            return;
        }

        const registrationEvents = await prisma.registrationEvent.findMany({
            where: { event_id: eventId },
            include: {
                members: true,
                registration: {
                    include: {
                        user: true,
                    },
                },
            },
            orderBy: {
                registration: {
                    created_at: 'desc',
                },
            },
        });

        const memberEnvIds = Array.from(
            new Set(
                registrationEvents
                    .flatMap((registrationEvent) => registrationEvent.members.map((member) => member.env_id))
                    .filter(Boolean)
            )
        );

        const memberUsers = memberEnvIds.length
            ? await prisma.user.findMany({
                where: {
                    env_id: { in: memberEnvIds },
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    phone: true,
                    college: true,
                    department: true,
                    degree: true,
                    gender: true,
                    usn: true,
                    env_id: true,
                },
            })
            : [];

        const userByEnvId = new Map<string, typeof memberUsers[number]>();
        memberUsers.forEach((user) => {
            if (user.env_id) {
                userByEnvId.set(user.env_id, user);
            }
        });

        const mappedRegistrations = registrationEvents.map((registrationEvent) => {
            const payer = registrationEvent.registration.user;
            const mappedMembers = (registrationEvent.members || []).map((member) => {
                const matchedUser = userByEnvId.get(member.env_id);
                return {
                    id: member.id,
                    name: member.name,
                    envId: member.env_id,
                    usn: matchedUser?.usn || null,
                    email: matchedUser?.email || null,
                    phone: matchedUser?.phone || null,
                    college: matchedUser?.college || null,
                    department: matchedUser?.department || null,
                    degree: matchedUser?.degree || null,
                    gender: matchedUser?.gender || null,
                    isLeader: member.is_leader,
                };
            });

            const fallbackMember = {
                id: `fallback-${registrationEvent.id}`,
                name: payer.name,
                envId: payer.env_id || null,
                usn: payer.usn || null,
                email: payer.email || null,
                phone: payer.phone || null,
                college: payer.college || null,
                department: payer.department || null,
                degree: payer.degree || null,
                gender: payer.gender || null,
                isLeader: true,
            };

            return {
                id: registrationEvent.id,
                registrationId: registrationEvent.registration_id,
                teamName: registrationEvent.team_name || null,
                paymentStatus: registrationEvent.registration.payment_status,
                totalAmount: Number(registrationEvent.registration.total_amount || 0),
                utrId: registrationEvent.registration.utr_id,
                registeredAt: registrationEvent.registration.created_at,
                payer: {
                    id: payer.id,
                    name: payer.name,
                    email: payer.email,
                    phone: payer.phone,
                    college: payer.college,
                    department: payer.department,
                    degree: payer.degree,
                    gender: payer.gender,
                    usn: payer.usn,
                    envId: payer.env_id,
                },
                members: mappedMembers.length ? mappedMembers : [fallbackMember],
            };
        });

        const approvedStatuses = new Set(['verified', 'completed']);
        const rejectedStatuses = new Set(['rejected', 'failed', 'cancelled']);
        const approvedRegistrations = mappedRegistrations.filter((reg) => approvedStatuses.has(String(reg.paymentStatus).toLowerCase())).length;
        const pendingRegistrations = mappedRegistrations.filter((reg) => {
            const status = String(reg.paymentStatus).toLowerCase();
            return !approvedStatuses.has(status) && !rejectedStatuses.has(status);
        }).length;
        const rejectedRegistrations = mappedRegistrations.filter((reg) => rejectedStatuses.has(String(reg.paymentStatus).toLowerCase())).length;

        const uniqueMemberIds = new Set<string>();
        mappedRegistrations.forEach((registration) => {
            registration.members.forEach((member) => {
                const key = member.envId || `member-${registration.registrationId}-${member.name}`;
                uniqueMemberIds.add(key);
            });
        });

        const teamCount = mappedRegistrations.filter((registration) => (registration.teamName && registration.members.length > 1)).length;
        const approvedRevenue = mappedRegistrations
            .filter((reg) => approvedStatuses.has(String(reg.paymentStatus).toLowerCase()))
            .reduce((sum, reg) => sum + Number(reg.totalAmount || 0), 0);

        res.json({
            event: {
                id: event.id,
                name: event.event_name,
                department: event.department.department_name,
                eventType: event.event_type,
                isMegaEvent: event.is_mega_event,
                isTeamEvent: event.is_team_event,
                fee: Number(event.fee),
                day: event.day,
                time: event.time,
                venue: event.venue,
                status: event.status,
            },
            summary: {
                registrationCount: mappedRegistrations.length,
                studentCount: uniqueMemberIds.size,
                teamCount,
                approvedRegistrations,
                pendingRegistrations,
                rejectedRegistrations,
                approvedRevenue,
            },
            registrations: mappedRegistrations,
        });
    } catch (error) {
        console.error('Error fetching event registration details:', error);
        res.status(500).json({ message: 'Error fetching event registration details' });
    }
};

export const updateEventStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['OPEN', 'CLOSED'].includes(status)) {
            res.status(400).json({ message: 'Status must be OPEN or CLOSED' });
            return;
        }

        const event = await prisma.event.update({
            where: { id: Number(id) },
            data: { status },
        });

        res.json({
            message: `Event ${status === 'OPEN' ? 'opened' : 'closed'} successfully`,
            event: { id: event.id, event_name: event.event_name, status: event.status },
        });
    } catch (error) {
        console.error('Error updating event status:', error);
        res.status(500).json({ message: 'Error updating event status' });
    }
};

export const closeAllEvents = async (req: Request, res: Response) => {
    try {
        const result = await prisma.event.updateMany({
            where: { status: 'OPEN' },
            data: { status: 'CLOSED' },
        });
        res.json({ message: `${result.count} event(s) closed`, closedCount: result.count });
    } catch (error) {
        console.error('Error closing all events:', error);
        res.status(500).json({ message: 'Error closing all events' });
    }
};

export const openAllEvents = async (req: Request, res: Response) => {
    try {
        const result = await prisma.event.updateMany({
            where: { status: 'CLOSED' },
            data: { status: 'OPEN' },
        });
        res.json({ message: `${result.count} event(s) opened`, openedCount: result.count });
    } catch (error) {
        console.error('Error opening all events:', error);
        res.status(500).json({ message: 'Error opening all events' });
    }
};
