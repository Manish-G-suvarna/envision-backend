import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();
const prisma = new PrismaClient();

async function main() {
    // Audit found 4 remaining unregistered members in various teams:

    // 1. HackOrbit - Treasure Hunt
    const treasureHuntEvent = await prisma.event.findFirst({ where: { event_name: { contains: 'Treasure' } }, select: { id: true } });
    const envIdsHackOrbit = ['ENV-000005', 'ENV-000001', 'ENV-000161']; // THEJAS B K, Shreya K, Nisha Shetty

    const removedHackOrbit = await prisma.registrationMember.deleteMany({
        where: {
            env_id: { in: envIdsHackOrbit },
            registration_event: { event_id: treasureHuntEvent?.id }
        }
    });
    console.log(`✅ Removed ${removedHackOrbit.count} members from HackOrbit (Treasure Hunt)`);

    // 2. Reverse Coding (no team name)
    const reverseCodingEvent = await prisma.event.findFirst({ where: { event_name: { contains: 'Reverse' } }, select: { id: true } });
    const removedReverseCoding = await prisma.registrationMember.deleteMany({
        where: {
            env_id: 'ENV-000109', // Sarvesh Marathe
            registration_event: { event_id: reverseCodingEvent?.id }
        }
    });
    console.log(`✅ Removed Sarvesh Marathe (ENV-000109) from Reverse Coding: ${removedReverseCoding.count} record(s) deleted`);

    console.log('\nFinal cleanup complete. Re-run check-members.ts one last time.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
