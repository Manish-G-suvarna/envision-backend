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
                const revenue = await prisma.registration.aggregate({
                    _sum: { total_amount: true },
                    where: {
                        payment_status: 'verified',
                        events: { some: { event_id: event.id } },
                    },
                });

                return {
                    id: event.id,
                    event_name: event.event_name,
                    department: event.department.department_name,
                    fee: Number(event.fee),
                    event_type: event.event_type,
                    is_team_event: event.is_team_event,
                    team_min_size: event.team_min_size,
                    team_max_size: event.team_max_size,
                    status: event.status,
                    is_mega_event: event.is_mega_event,
                    _count: { registrations: event._count.registrations },
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
            is_team_event: event.is_team_event,
            team_min_size: event.team_min_size,
            team_max_size: event.team_max_size,
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
