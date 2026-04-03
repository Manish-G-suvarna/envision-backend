import { Request, Response } from 'express';
import prisma from '../config/prisma';

export const getEvents = async (req: Request, res: Response) => {
    try {
        const events = await prisma.event.findMany({
            include: {
                department: true,
                rules: true,
                rounds: true,
                criteria: true,
            },
        });

        const formattedEvents = events.map(event => ({
            id: event.id,
            title: event.event_name,
            japaneseName: event.japanese_name,
            description: event.description,
            overview: event.overview,
            fee: Number(event.fee),
            category: event.department.department_name,
            type: event.event_type,
            isTeamEvent: event.is_team_event,
            teamSize: event.is_team_event ? {
                min: event.team_min_size,
                max: event.team_max_size,
            } : null,
            isMega: event.is_mega_event,
            imageUrl: event.image_url,
            day: event.day,
            time: event.time,
            venue: event.venue,
            rules: event.rules.map(r => r.content),
            rounds: event.rounds.map(r => ({
                roundNumber: r.round_number,
                name: r.name,
                format: r.format,
                evaluation: r.evaluation,
                duration: r.duration,
            })),
            criteria: event.criteria.map(c => c.content),
        }));

        res.json(formattedEvents);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ message: 'Error fetching events' });
    }
};
