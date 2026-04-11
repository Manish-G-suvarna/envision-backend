import { Request, Response } from 'express';
import prisma from '../../config/prisma';
import { AuthenticatedRequest } from '../../types/auth';
import { getAdminDepartmentFilter } from '../../utils/adminScope';

export const listTeams = async (req: Request, res: Response) => {
    try {
        const authReq = req as AuthenticatedRequest;
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 100;
        const eventId = req.query.eventId ? Number(req.query.eventId) : undefined;
        const search = req.query.search as string || '';
        const skip = (page - 1) * limit;

        const allowedDepartments = getAdminDepartmentFilter(authReq);

        const whereClause: any = {
            team_name: { not: null },
        };

        if (eventId) {
            whereClause.event_id = eventId;
        }

        if (search) {
            whereClause.OR = [
                { team_name: { contains: search, mode: 'insensitive' } },
                { members: { some: { name: { contains: search, mode: 'insensitive' } } } },
                { registration: { user: { name: { contains: search, mode: 'insensitive' } } } }
            ];
        }

        if (allowedDepartments) {
            whereClause.event = {
                department: {
                    department_name: { in: allowedDepartments },
                },
            };
        }

        const teams = await prisma.registrationEvent.findMany({
            where: whereClause,
            skip,
            take: limit,
            include: {
                event: {
                    include: {
                        department: true,
                    },
                },
                members: true,
                registration: {
                    include: {
                        user: {
                            select: {
                                name: true,
                                email: true,
                                env_id: true,
                            }
                        }
                    }
                },
            },
            orderBy: { id: 'desc' },
        });

        const total = await prisma.registrationEvent.count({ where: whereClause });

        const formattedTeams = teams.map(t => ({
            id: t.id,
            teamName: t.team_name,
            eventName: t.event.event_name,
            department: t.event.department?.department_name || null,
            paymentStatus: t.registration.payment_status,
            utrId: t.registration.utr_id,
            amount: Number(t.registration.total_amount),
            leader: t.registration.user.name,
            leaderEnvId: t.registration.user.env_id,
            leaderEmail: t.registration.user.email,
            members: t.members.map(m => ({
                id: m.id,
                name: m.name,
                envId: m.env_id,
                isLeader: m.is_leader,
            })),
            registeredAt: t.registration.created_at,
        }));

        res.json({
            data: formattedTeams,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error('Error listing teams:', error);
        res.status(500).json({ message: 'Error listing teams' });
    }
};
