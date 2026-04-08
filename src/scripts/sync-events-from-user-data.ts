import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { userData } from '../../user_event_data';

dotenv.config();

const prisma = new PrismaClient();

const EVENT_TITLE_ALIASES: Record<string, string[]> = {
  'Feast Fiesta(Eating Challenge)': ['Hogathon'],
};

const TEAM_EVENT_CONFIG: Record<string, { min: number; max: number }> = {
  'Group Dance': { min: 4, max: 15 },
  Cricket: { min: 8, max: 8 },
  Rahasya: { min: 3, max: 4 },
  'Blind Coding': { min: 2, max: 2 },
  'Reverse Coding': { min: 1, max: 2 },
  'Operation Cipher Chase': { min: 2, max: 3 },
  'Mad Ad': { min: 3, max: 4 },
  'Line Follower': { min: 2, max: 4 },
  'Circuit Heist': { min: 2, max: 2 },
  Memoria: { min: 2, max: 2 },
  'Water Rocketry': { min: 1, max: 4 },
  'Dumb Charades': { min: 2, max: 2 },
  BGMI: { min: 2, max: 4 },
  'Treasure Hunt': { min: 3, max: 5 },
  'Free Fire': { min: 4, max: 4 },
  'Anime Quiz': { min: 2, max: 2 },
};

function getFee(title: string, category: string): number {
  return 100;
}

async function getDepartmentIds() {
  const names = ['Technical', 'Non-Technical', 'Mega'] as const;
  const departments = await Promise.all(
    names.map((department_name) =>
      prisma.department.upsert({
        where: { department_name },
        update: {},
        create: { department_name },
      })
    )
  );

  return {
    Technical: departments[0].id,
    'Non-Technical': departments[1].id,
    Mega: departments[2].id,
  } as Record<string, number>;
}

async function syncEventChildren(eventId: number, event: (typeof userData)[number]) {
  await prisma.rule.deleteMany({ where: { event_id: eventId } });
  await prisma.round.deleteMany({ where: { event_id: eventId } });
  await prisma.judgingCriteria.deleteMany({ where: { event_id: eventId } });

  if (event.rules.length > 0) {
    await prisma.rule.createMany({
      data: event.rules.map((content) => ({
        event_id: eventId,
        content,
      })),
    });
  }

  if (event.rounds.length > 0) {
    await prisma.round.createMany({
      data: event.rounds.map((round) => ({
        event_id: eventId,
        round_number: round.roundNumber,
        name: round.name,
        format: round.format,
        evaluation: round.evaluation,
        duration: round.duration ?? null,
      })),
    });
  }

  if (event.criteria.length > 0) {
    await prisma.judgingCriteria.createMany({
      data: event.criteria.map((content) => ({
        event_id: eventId,
        content,
      })),
    });
  }
}

async function main() {
  const departmentIds = await getDepartmentIds();

  for (const event of userData) {
    const teamConfig = TEAM_EVENT_CONFIG[event.title];
    const eventNames = [event.title, ...(EVENT_TITLE_ALIASES[event.title] || [])];

    const existingEvent = await prisma.event.findFirst({
      where: { event_name: { in: eventNames } },
      orderBy: { id: 'asc' },
    });

    const eventPayload = {
      event_name: event.title,
      japanese_name: event.japaneseName,
      description: event.overview,
      overview: event.overview,
      image_url: event.imageUrl,
      day: event.day,
      time: event.time,
      venue: event.venue,
      fee: getFee(event.title, event.category),
      event_type: event.category === 'Technical' ? 'Technical' : 'Non_Technical',
      is_mega_event: event.category === 'Mega',
      department_id: departmentIds[event.category],
      is_team_event: Boolean(teamConfig),
      team_min_size: teamConfig?.min ?? null,
      team_max_size: teamConfig?.max ?? null,
    } as const;

    const syncedEvent = existingEvent
      ? await prisma.event.update({
          where: { id: existingEvent.id },
          data: eventPayload,
        })
      : await prisma.event.create({
          data: eventPayload,
        });

    await syncEventChildren(syncedEvent.id, event);
    console.log(`Synced ${event.title}`);
  }

  console.log(`Completed syncing ${userData.length} events from user data.`);
}

main()
  .catch((error) => {
    console.error('Failed to sync events from user data:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
