import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const formatEnvId = (id: number) => `ENV-${id.toString().padStart(3, '0')}`;

async function main() {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            env_id: true,
        },
        orderBy: { id: 'asc' },
    });

    let updated = 0;

    for (const user of users) {
        const nextEnvId = formatEnvId(user.id);
        if (user.env_id === nextEnvId) continue;

        await prisma.user.update({
            where: { id: user.id },
            data: { env_id: nextEnvId },
        });
        updated += 1;
    }

    console.log(`Updated ${updated} user ENV IDs.`);
}

main()
    .catch((error) => {
        console.error('Failed to sync ENV IDs:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
