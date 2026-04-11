import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
    const result = await prisma.event.updateMany({
        where: {
            OR: [
                { event_name: { contains: 'Dance Battle' } },
                { japanese_name: { contains: 'Ronin Rhythm' } },
            ]
        },
        data: { fee: 200 }
    });
    console.log(`✅ Updated ${result.count} event(s) — Dance Battle fee set to ₹200`);

    // Verify
    const events = await prisma.event.findMany({
        where: { OR: [{ event_name: { contains: 'Dance Battle' } }, { japanese_name: { contains: 'Ronin Rhythm' } }] },
        select: { id: true, event_name: true, japanese_name: true, fee: true }
    });
    console.log('Current state:', events);
}

main().catch(console.error).finally(() => prisma.$disconnect());
