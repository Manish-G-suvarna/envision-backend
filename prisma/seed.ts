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
    await prisma.event.create({
      data: {
        event_name:    ev.title,
        japanese_name: ev.japaneseName,
        description:   ev.overview,
        overview:      ev.overview,
        image_url:     ev.imageUrl,
        day:           ev.day,
        time:          ev.time,
        venue:         ev.venue,
        event_type:    ev.category === 'Technical' ? 'Technical' : 'Non_Technical',
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
