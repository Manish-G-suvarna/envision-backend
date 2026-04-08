const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const events = await prisma.event.findMany({
    select: {
      id: true,
      event_name: true,
      team_min_size: true,
      team_max_size: true,
      is_mega_event: true,
      event_type: true
    },
    orderBy: { event_name: 'asc' }
  });
  console.log(JSON.stringify(events, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
