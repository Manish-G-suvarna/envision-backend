import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { userData as eventsData } from '../user_event_data';

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

async function main() {
  for (const event of eventsData) {
    const teamConfig = TEAM_EVENT_CONFIG[event.title];
    const fee = 100;
    const titlesToSync = [event.title, ...(EVENT_TITLE_ALIASES[event.title] || [])];

    await prisma.event.updateMany({
      where: { event_name: { in: titlesToSync } },
      data: {
        fee,
        is_team_event: Boolean(teamConfig),
        team_min_size: teamConfig?.min ?? null,
        team_max_size: teamConfig?.max ?? null,
      },
    });
  }

  console.log(`Synced metadata for ${eventsData.length} events.`);
}

main()
  .catch((error) => {
    console.error('Failed to sync event metadata:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
