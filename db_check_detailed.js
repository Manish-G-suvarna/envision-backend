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
    
    events.forEach(e => {
        console.log(`EVENT: ${e.event_name} | ID: ${e.id} | MIN: ${e.team_min_size} | MAX: ${e.team_max_size} | TEAM: ${e.is_team_event}`);
    });
    
    await prisma.$disconnect();
}
check();
