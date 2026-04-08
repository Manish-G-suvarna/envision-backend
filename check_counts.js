const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCounts() {
  try {
    const counts = {
      users: await prisma.user.count(),
      registrations: await prisma.registration.count(),
      registrationEvents: await prisma.registrationEvent.count(),
      registrationMembers: await prisma.registrationMember.count(),
      participants: await prisma.participant.count(),
      events: await prisma.event.count(),
      departments: await prisma.department.count(),
      admins: await prisma.admin.count(),
    };
    
    console.log('--- Database Record Counts ---');
    console.table(counts);
  } catch (err) {
    console.error('Error counting records:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkCounts();
