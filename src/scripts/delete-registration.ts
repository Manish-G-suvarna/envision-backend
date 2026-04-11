import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    // Find RegistrationEvent for Cricket team 'M' with leader Mukta Bhat
    const registrationEvent = await prisma.registrationEvent.findFirst({
        where: {
            team_name: 'M',
            event: { event_name: { contains: 'Cricket' } },
            registration: {
                user: { env_id: 'ENV-000154' }
            }
        },
        include: {
            registration: true
        }
    });

    if (!registrationEvent) {
        console.log('❌ Could not find registration for Team M / Cricket / ENV-000154');
        return;
    }

    console.log(`Found Registration #${registrationEvent.registration_id} (Event: ${registrationEvent.event_id}, Team: ${registrationEvent.team_name})`);

    // Delete members
    const members = await prisma.registrationMember.deleteMany({
        where: { registration_event_id: registrationEvent.id }
    });
    console.log(`✅ Deleted ${members.count} members from team record`);

    // Delete RegistrationEvent
    await prisma.registrationEvent.delete({
        where: { id: registrationEvent.id }
    });
    console.log(`✅ Deleted team registration event entry`);

    // If this was the only event in that registration, delete the registration itself?
    // Let's check if there are other events.
    const otherEvents = await prisma.registrationEvent.count({
        where: { registration_id: registrationEvent.registration_id }
    });

    if (otherEvents === 0) {
        await prisma.registration.delete({
            where: { id: registrationEvent.registration_id }
        });
        console.log(`✅ Deleted main registration record (was the only event)`);
    } else {
        console.log(`ℹ️ Main registration record kept as it has ${otherEvents} other event(s)`);
    }

    console.log('\nDeletion complete.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
