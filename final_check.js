const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function finalCheck() {
  try {
    const userCount = await prisma.user.count();
    const registrationCount = await prisma.registration.count();
    const participantCount = await prisma.participant.count();
    
    console.log('--- Verification Summary ---');
    console.log(`Users remaining: ${userCount}`);
    console.log(`Registrations remaining: ${registrationCount}`);
    console.log(`Participants remaining: ${participantCount}`);
    console.log('--- End of Summary ---');
  } catch (err) {
    console.error('Verification error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

finalCheck();
