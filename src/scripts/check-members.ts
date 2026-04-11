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
            registration: { select: { payment_status: true } }
        },
        orderBy: { id: 'asc' }
    });

    let issues = 0;

    for (const team of teams) {
        console.log(`\n${'='.repeat(55)}`);
        console.log(`🏷️  ${team.team_name || '(no name)'} — ${team.event?.event_name} [${team.registration.payment_status}]`);
        console.log(`${'='.repeat(55)}`);

        for (const member of team.members) {
            // Find this member's own registration for the same event
            const userReg = await prisma.registrationEvent.findFirst({
                where: {
                    event_id: team.event_id,
                    registration: {
                        user: { env_id: member.env_id }
                    }
                },
                include: {
                    registration: { select: { payment_status: true, utr_id: true } }
                }
            });

            const icon = member.is_leader ? '👑' : '   ';
            if (!userReg) {
                console.log(`${icon} ${member.name} (${member.env_id}) → ❌ NOT REGISTERED`);
                issues++;
            } else {
                const s = userReg.registration.payment_status;
                const statusIcon = s === 'verified' ? '✅' : s === 'pending' ? '⏳' : '❌';
                console.log(`${icon} ${member.name} (${member.env_id}) → ${statusIcon} ${s} | UTR: ${userReg.registration.utr_id || 'none'}`);
            }
        }
    }

    console.log(`\n${'='.repeat(55)}`);
    console.log(`⚠️  Total members with NO registration: ${issues}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
