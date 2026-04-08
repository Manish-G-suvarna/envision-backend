const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkEvents() {
  try {
    const events = await prisma.event.findMany({
      select: {
        id: true,
        event_name: true,
        team_min_size: true,
        team_max_size: true,
        is_team_event: true,
        is_mega_event: true
      }
    });
    console.log(JSON.stringify(events, null, 2));
  } catch (err) {
    console.error('Validation Error Details:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkEvents();
