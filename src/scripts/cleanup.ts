import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🚨 CLEANUP SEQUENCE INITIATED...');

    try {
        // Delete in order of dependency to avoid foreign key errors
        console.log('🗑️ Clearing RegistrationMember...');
        await prisma.registrationMember.deleteMany({});

        console.log('🗑️ Clearing RegistrationEvent...');
        await prisma.registrationEvent.deleteMany({});

        console.log('🗑️ Clearing Registration...');
        await prisma.registration.deleteMany({});

        console.log('🗑️ Clearing Legacy Participant table...');
        await prisma.participant.deleteMany({});

        console.log('🗑️ Clearing VerifiedTransaction pool...');
        await prisma.verifiedTransaction.deleteMany({});

        console.log('✨ DATABASE RECLAIMS READY. ALL PARTICIPANT DATA PURGED.');
    } catch (error) {
        console.error('❌ CLEANUP FAILED:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
