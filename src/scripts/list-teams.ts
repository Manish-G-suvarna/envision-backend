import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function main() {
    const teams = await prisma.registrationEvent.findMany({
        where: { team_name: { not: null } },
        include: {
            event: { select: { event_name: true } },
            members: true,
            registration: { select: { payment_status: true, utr_id: true } }
        },
        orderBy: { id: 'asc' }
    });

    console.log(`\n${'='.repeat(60)}`);
    console.log(`👥 TEAMS (${teams.length} total)`);
    console.log(`${'='.repeat(60)}`);

    for (const t of teams) {
        console.log(`\n🏷️  ${t.team_name} — ${t.event?.event_name} [${t.registration.payment_status}]`);
        for (const m of t.members) {
            console.log(`   ${m.is_leader ? '👑' : '  '} ${m.name} (${m.env_id})`);
        }
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
