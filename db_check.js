const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const events = await prisma.event.findMany({
        select: {
            id: true,
            event_name: true,
            team_min_size: true,
            team_max_size: true,
            is_team_event: true
        }
    });
    console.log(JSON.stringify(events, null, 2));
    await prisma.$disconnect();
}
check();
