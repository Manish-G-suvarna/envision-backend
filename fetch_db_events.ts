import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const events = await prisma.event.findMany({
    include: {
      rules: true,
      rounds: true,
      criteria: true,
    },
    orderBy: {
      id: 'asc'
    }
  });

  console.log(JSON.stringify(events, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
