import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('Starting purge of student profiles and registration data...');

    try {
        await prisma.registrationMember.deleteMany({});
        console.log('Cleared RegistrationMember');

        await prisma.registrationEvent.deleteMany({});
        console.log('Cleared RegistrationEvent');

        await prisma.registration.deleteMany({});
        console.log('Cleared Registration');

        await prisma.participant.deleteMany({});
        console.log('Cleared legacy Participant');

        await prisma.verifiedTransaction.deleteMany({});
        console.log('Cleared VerifiedTransaction');

        await prisma.user.deleteMany({});
        console.log('Cleared User profiles');

        console.log('Purge complete.');
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(async (error) => {
    console.error('Purge failed:', error);
    await prisma.$disconnect();
    process.exit(1);
});
