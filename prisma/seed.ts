import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import { megaEvents } from './megaEvents';
import { techEvents } from './techEvents';
import { nonTechEvents } from './nonTechEvents';

dotenv.config();

const prisma = new PrismaClient();

const eventsData = [
  ...megaEvents,
  ...techEvents,
  ...nonTechEvents,
];

const TEAM_EVENT_CONFIG: Record<string, { min: number; max: number }> = {
  'Group Dance': { min: 4, max: 15 },
  'Cricket': { min: 8, max: 8 },
  'Rahasya': { min: 3, max: 4 },
  'Blind Coding': { min: 2, max: 2 },
  'Reverse Coding': { min: 1, max: 2 },
  'Operation Cipher Chase': { min: 2, max: 3 },
  'Mad Ad': { min: 3, max: 4 },
  'Line Follower': { min: 2, max: 4 },
  'Circuit Heist': { min: 2, max: 2 },
  'Memoria': { min: 2, max: 2 },
  'Water Rocketry': { min: 1, max: 4 },
  'Dumb Charades': { min: 2, max: 2 },
  'BGMI': { min: 2, max: 4 },
  'Treasure Hunt': { min: 3, max: 5 },
  'Free Fire': { min: 4, max: 4 },
  'Anime Quiz': { min: 2, max: 2 },
};

async function main() {
  console.log('🗑️  Clearing existing data...');
  await prisma.rule.deleteMany();
  await prisma.round.deleteMany();
  await prisma.judgingCriteria.deleteMany();
  await prisma.participant.deleteMany();
  await prisma.event.deleteMany();
  await prisma.department.deleteMany();

  console.log('🏢 Creating departments...');
  const deptTechnical    = await prisma.department.create({ data: { department_name: 'Technical' } });
  const deptNonTechnical = await prisma.department.create({ data: { department_name: 'Non-Technical' } });
  const deptMega         = await prisma.department.create({ data: { department_name: 'Mega' } });

  const deptMap: Record<string, number> = {
    'Technical':     deptTechnical.id,
    'Non-Technical': deptNonTechnical.id,
    'Mega':          deptMega.id,
  };

  console.log('🎉 Seeding events...');
  for (const ev of eventsData) {
    const teamConfig = TEAM_EVENT_CONFIG[ev.title];

    await prisma.event.create({
      data: {
        event_name:    ev.title,
        japanese_name: ev.japaneseName,
        description:   ev.overview,
        overview:      ev.overview,
        fee:           ev.category === 'Mega' ? 200 : 100,
        image_url:     ev.imageUrl,
        day:           ev.day,
        time:          ev.time,
        venue:         ev.venue,
        event_type:    ev.category === 'Technical' ? 'Technical' : 'Non_Technical',
        is_team_event: Boolean(teamConfig),
        team_min_size: teamConfig?.min ?? null,
        team_max_size: teamConfig?.max ?? null,
        is_mega_event: ev.category === 'Mega',
        department_id: deptMap[ev.category] ?? deptTechnical.id,
        rules: {
          create: ev.rules.map(content => ({ content })),
        },
        rounds: {
          create: ev.rounds.map(r => ({
            round_number: r.roundNumber,
            name:         r.name,
            format:       r.format,
            evaluation:   r.evaluation,
            duration:     r.duration ?? null,
          })),
        },
        criteria: {
          create: ev.criteria.map(content => ({ content })),
        },
      },
    });
    console.log(`  ✅ ${ev.title}`);
  }

  console.log(`\n✨ Database seeded successfully! (${eventsData.length} events)`);
}

main()
  .catch(e => {
    console.error('❌ SEED ERROR:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
