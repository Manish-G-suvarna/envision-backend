const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const eventMappings = [
  // Mega Events
  { name: 'Group Dance', min: 4, max: 15 },
  { name: 'Cricket', min: 8, max: 8 },
  
  // Technical Events
  { name: 'Rahasya', min: 3, max: 4 },
  { name: 'Blind Coding', min: 2, max: 2 },
  { name: 'Reverse Coding', min: 1, max: 2 },
  { name: 'Operation Cipher Chase', min: 2, max: 3 },
  { name: 'Mad Ad', min: 3, max: 4 },
  { name: 'Line Follower', min: 2, max: 4 },
  { name: 'Circuit Heist', min: 2, max: 2 },
  { name: 'Memoria', min: 2, max: 2 },
  { name: 'Water Rocketry', min: 1, max: 4 },
  
  // Non-Technical Events
  { name: 'Dumb Charades', min: 2, max: 2 },
  { name: 'BGMI', min: 2, max: 4 },
  { name: 'Treasure Hunt', min: 3, max: 5 },
  { name: 'Free Fire', min: 4, max: 4 },
  { name: 'Anime Quiz', min: 2, max: 2 }
];

async function updateConstraints() {
  console.log('🚀 Starting Event Team Constraints Update...');
  
  for (const mapping of eventMappings) {
    try {
      // Use case-insensitive search for the event name to handle variations
      const events = await prisma.event.findMany({
        where: {
          event_name: {
            contains: mapping.name,
            mode: 'insensitive'
          }
        }
      });

      if (events.length === 0) {
        console.warn(`⚠️  Warning: No event found matching "${mapping.name}"`);
        continue;
      }

      for (const event of events) {
        await prisma.event.update({
          where: { id: event.id },
          data: {
            team_min_size: mapping.min,
            team_max_size: mapping.max,
            is_team_event: true // Force to true since user provided team sizes
          }
        });
        console.log(`✅ Updated "${event.event_name}" (ID: ${event.id}): Min=${mapping.min}, Max=${mapping.max}`);
      }
    } catch (err) {
      console.error(`❌ Error updating "${mapping.name}":`, err.message);
    }
  }

  console.log('🏁 Update Procedure Complete.');
  await prisma.$disconnect();
}

updateConstraints();
