import { Request, Response } from 'express';
import prisma from '../../config/prisma';

export const listParticipants = async (req: Request, res: Response) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 100;
        const status = req.query.status as string | undefined;
        const skip = (page - 1) * limit;

        const whereClause: any = {};
        if (status) whereClause.payment_status = status;

        const registrations = await prisma.registration.findMany({
            where: whereClause,
            skip,
            take: limit,
            include: {
                user: true,
                events: {
                    include: {
                        event: {
                            select: { event_name: true },
                        },
                    },
                },
            },
            orderBy: { created_at: 'desc' },
        });

        const total = await prisma.registration.count({ where: whereClause });

        const formattedParticipants = registrations.map(reg => ({
            id: reg.id,
            studentName: reg.user.name,
            email: reg.user.email,
            phone: reg.user.phone,
            college: reg.user.college,
            events: reg.events.map(e => e.event.event_name),
            paymentStatus: reg.payment_status,
            amountPaid: Number(reg.total_amount),
            utrId: reg.utr_id,
            registeredAt: reg.created_at,
        }));

        res.json({
            data: formattedParticipants,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error('Error listing participants:', error);
        res.status(500).json({ message: 'Error listing participants' });
    }
};

export const getParticipantById = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const registration = await prisma.registration.findUnique({
            where: { id: Number(id) },
            include: {
                user: true,
                events: {
                    include: {
                        event: {
                            select: { id: true, event_name: true, fee: true },
                        },
                    },
                },
            },
        });

        if (!registration) {
            res.status(404).json({ message: 'Registration not found' });
            return;
        }

        res.json({
            id: registration.id,
            studentName: registration.user.name,
            email: registration.user.email,
            phone: registration.user.phone,
            college: registration.user.college,
            events: registration.events.map(e => e.event.event_name),
            paymentStatus: registration.payment_status,
            amountPaid: Number(registration.total_amount),
            utrId: registration.utr_id,
            registeredAt: registration.created_at,
        });
    } catch (error) {
        console.error('Error fetching registration:', error);
        res.status(500).json({ message: 'Error fetching registration' });
    }
};

export const updatePaymentStatus = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { payment_status } = req.body;

        const validStatuses = ['pending', 'verified', 'rejected'];
        if (!validStatuses.includes(payment_status)) {
            res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
            return;
        }

        const registration = await prisma.registration.update({
            where: { id: Number(id) },
            data: { payment_status },
            include: {
                user: { select: { name: true, email: true } },
                events: { include: { event: { select: { event_name: true } } } },
            },
        });

        res.json({
            message: `Payment status updated to ${payment_status}`,
            registration: {
                id: registration.id,
                studentName: registration.user.name,
                email: registration.user.email,
                events: registration.events.map(e => e.event.event_name),
                paymentStatus: registration.payment_status,
            },
        });
    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({ message: 'Error updating payment status' });
    }
};

export const removeParticipant = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        // Delete related records first
        await prisma.registrationEvent.deleteMany({ where: { registration_id: Number(id) } });
        await prisma.registration.delete({ where: { id: Number(id) } });

        res.status(204).send();
    } catch (error) {
        console.error('Error removing registration:', error);
        res.status(500).json({ message: 'Error removing registration' });
    }
};
