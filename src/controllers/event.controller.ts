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
            event_name: event.event_name,
            title: event.event_name,
            name: event.event_name,
            japanese_name: event.japanese_name,
            japaneseName: event.japanese_name,
            description: event.description,
            overview: event.overview,
            fee: Number(event.fee),
            category: event.is_mega_event ? 'Mega' : event.event_type,
            department: event.department,
            department_name: event.department.department_name,
            event_type: event.event_type,
            type: event.event_type,
            is_mega_event: Boolean(event.is_mega_event),
            isMega: event.is_mega_event,
            image_url: event.image_url,
            imageUrl: event.image_url,
            day: event.day,
            time: event.time,
            venue: event.venue,
            is_team_event: event.is_team_event,
            isTeamEvent: event.is_team_event,
            team_min_size: event.team_min_size,
            team_max_size: event.team_max_size,
            minTeamSize: event.team_min_size,
            maxTeamSize: event.team_max_size,
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
