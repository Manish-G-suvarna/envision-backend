import { Request, Response } from 'express';
import prisma from '../../config/prisma';

export const getDashboardStats = async (req: Request, res: Response) => {
    try {
        const [totalRevenue, totalUsers, totalEvents, openEvents, verifiedRegistrations] = await Promise.all([
            prisma.registration.aggregate({
                _sum: { total_amount: true },
                where: { payment_status: 'verified' },
            }),
            prisma.user.count(),
            prisma.event.count(),
            prisma.event.count({ where: { status: 'OPEN' } }),
            prisma.registration.count({ where: { payment_status: 'verified' } }),
        ]);

        res.json({
            totalRevenue: Number(totalRevenue._sum.total_amount || 0),
            totalStudents: totalUsers,
            totalEvents,
            openEvents,
            verifiedPayments: verifiedRegistrations,
        });
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
        res.status(500).json({ message: 'Error fetching dashboard stats' });
    }
};

export const getAllStudents = async (req: Request, res: Response) => {
    try {
        const page = (req.query.page as any) || 1;
        const limit = (req.query.limit as any) || 1000;
        const search = (req.query.search as string) || '';
        const skip = (page - 1) * limit;

        const where: any = {};
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { usn: { contains: search, mode: 'insensitive' } },
            ];
        }

        const students = await prisma.user.findMany({
            where,
            skip,
            take: limit,
            include: {
                registrations: {
                    include: {
                        events: {
                            include: {
                                event: {
                                    select: {
                                        id: true,
                                        event_name: true,
                                        fee: true,
                                    },
                                },
                                members: {
                                    select: {
                                        id: true,
                                        name: true,
                                        env_id: true,
                                        is_leader: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        const total = await prisma.user.count({ where });

        const formattedStudents = students.map(s => ({
            id: s.id,
            name: s.name,
            email: s.email,
            phone: s.phone,
            college: s.college,
            department: s.department,
            degree: s.degree,
            gender: s.gender,
            usn: s.usn,
            envId: s.env_id,
            onboarded: s.is_onboarded,
            registrationCount: s.registrations.length,
            createdAt: s.createdAt,
            registrations: s.registrations.map(reg => ({
                id: reg.id,
                paymentStatus: reg.payment_status,
                utrId: reg.utr_id,
                totalAmount: Number(reg.total_amount),
                registeredAt: reg.created_at,
                events: reg.events.map(re => ({
                    id: re.event.id,
                    name: re.event.event_name,
                    fee: Number(re.event.fee),
                    teamName: re.team_name,
                    members: re.members.map(member => ({
                        id: member.id,
                        name: member.name,
                        envId: member.env_id,
                        isLeader: member.is_leader,
                    })),
                })),
            })),
        }));

        res.json({
            data: formattedStudents,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Error fetching students:', error);
        res.status(500).json({ message: 'Error fetching students' });
    }
};

export const getAllPayments = async (req: Request, res: Response) => {
    try {
        const page = req.query.page as any || 1;
        const limit = req.query.limit as any || 20;
        const status = req.query.status as any;
        const skip = (page - 1) * limit;

        const whereClause = status ? { payment_status: status } : {};

        const payments = await prisma.participant.findMany({
            where: whereClause,
            skip,
            take: limit,
            include: {
                event: {
                    select: {
                        id: true,
                        event_name: true,
                    },
                },
            },
            orderBy: { registered_at: 'desc' },
        });

        const total = await prisma.participant.count({ where: whereClause });

        const formattedPayments = payments.map(payment => ({
            id: payment.id,
            studentName: payment.student_name,
            email: payment.email,
            eventId: payment.event.id,
            eventName: payment.event.event_name,
            amountPaid: Number(payment.amount_paid),
            paymentStatus: payment.payment_status,
            paymentProof: payment.payment_proof,
            registeredAt: payment.registered_at,
        }));

        res.json({
            data: formattedPayments,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ message: 'Error fetching payments' });
    }
};
