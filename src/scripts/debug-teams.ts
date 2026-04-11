import prisma from '../config/prisma';

async function main() {
    console.log("Checking all RegistrationEvent records...");
    const all = await prisma.registrationEvent.findMany({
        take: 20,
        select: { id: true, team_name: true }
    });
    console.log("Samples:", all);

    const filtered = await prisma.registrationEvent.findMany({
        where: {
            AND: [
                { team_name: { not: null } },
                { team_name: { not: "" } }
            ]
        },
        take: 5
    });
    console.log("Filtered samples (not null and not empty):", filtered);
    
    const count = await prisma.registrationEvent.count({
        where: {
            AND: [
                { team_name: { not: null } },
                { team_name: { not: "" } }
            ]
        }
    });
    console.log("Total count with AND filter:", count);
}

main().catch(console.error).finally(() => prisma.$disconnect());
