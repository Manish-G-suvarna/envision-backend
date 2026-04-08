import { PrismaClient, EventType } from '@prisma/client';
import { userData } from './user_event_data';

const prisma = new PrismaClient();

type UserRound = {
  roundNumber: number;
  name: string | null;
  format: string | null;
  evaluation: string | null;
  duration: string | null;
};

function compareArrays(arr1: string[], arr2: string[]): boolean {
  if (arr1.length !== arr2.length) return false;
  return arr1.every((val, index) => val === arr2[index]);
}

function compareRounds(
  rounds1: UserRound[],
  rounds2: Array<{
    round_number: number;
    name: string | null;
    format: string | null;
    evaluation: string | null;
    duration: string | null;
  }>
): boolean {
  if (rounds1.length !== rounds2.length) return false;

  return rounds1.every((r1, index) => {
    const r2 = rounds2[index];
    return (
      r1.roundNumber === r2.round_number &&
      r1.name === r2.name &&
      r1.format === r2.format &&
      r1.evaluation === r2.evaluation &&
      (r1.duration === r2.duration || (!r1.duration && !r2.duration))
    );
  });
}

function getDbCategory(event: { is_mega_event: boolean | null; event_type: EventType }): string {
  if (event.is_mega_event) return 'Mega';
  return event.event_type === 'Non_Technical' ? 'Non-Technical' : 'Technical';
}

async function main() {
  const dbEvents = await prisma.event.findMany({
    include: {
      rules: { orderBy: { id: 'asc' } },
      rounds: { orderBy: { round_number: 'asc' } },
      criteria: { orderBy: { id: 'asc' } },
    },
  });

  const discrepancies: Array<Record<string, unknown>> = [];

  userData.forEach((userEvent) => {
    const dbEvent = dbEvents.find((event) => event.event_name === userEvent.title);

    if (!dbEvent) {
      discrepancies.push({ title: userEvent.title, error: 'Event not found in database' });
      return;
    }

    const eventDiffs: Record<string, unknown> = {};
    const dbCategory = getDbCategory(dbEvent);

    if (dbEvent.japanese_name !== userEvent.japaneseName) {
      eventDiffs.japaneseName = { db: dbEvent.japanese_name, user: userEvent.japaneseName };
    }
    if (dbEvent.image_url !== userEvent.imageUrl) {
      eventDiffs.imageUrl = { db: dbEvent.image_url, user: userEvent.imageUrl };
    }
    if (dbCategory !== userEvent.category) {
      eventDiffs.category = { db: dbCategory, user: userEvent.category };
    }
    if (dbEvent.description !== userEvent.overview) {
      eventDiffs.overview = { db: dbEvent.description, user: userEvent.overview };
    }
    if (dbEvent.day !== userEvent.day) {
      eventDiffs.day = { db: dbEvent.day, user: userEvent.day };
    }
    if (dbEvent.time !== userEvent.time) {
      eventDiffs.time = { db: dbEvent.time, user: userEvent.time };
    }
    if (dbEvent.venue !== userEvent.venue) {
      eventDiffs.venue = { db: dbEvent.venue, user: userEvent.venue };
    }

    const dbRules = dbEvent.rules.map((rule) => rule.content);
    if (!compareArrays(dbRules, userEvent.rules)) {
      eventDiffs.rules = { db: dbRules, user: userEvent.rules };
    }

    const dbCriteria = dbEvent.criteria.map((criteria) => criteria.content);
    if (!compareArrays(dbCriteria, userEvent.criteria)) {
      eventDiffs.criteria = { db: dbCriteria, user: userEvent.criteria };
    }

    if (!compareRounds(userEvent.rounds, dbEvent.rounds)) {
      eventDiffs.rounds = {
        db: dbEvent.rounds.map((round) => ({
          roundNumber: round.round_number,
          name: round.name,
          format: round.format,
          evaluation: round.evaluation,
          duration: round.duration,
        })),
        user: userEvent.rounds,
      };
    }

    if (Object.keys(eventDiffs).length > 0) {
      discrepancies.push({ title: userEvent.title, differences: eventDiffs });
    }
  });

  dbEvents.forEach((dbEvent) => {
    if (!userData.find((userEvent) => userEvent.title === dbEvent.event_name)) {
      discrepancies.push({ title: dbEvent.event_name, error: 'Event in DB but not in user data' });
    }
  });

  if (discrepancies.length === 0) {
    console.log('SUCCESS: All data matches!');
    return;
  }

  console.log('DISCREPANCIES FOUND:');
  console.log(JSON.stringify(discrepancies, null, 2));
}

main()
  .catch((error) => console.error(error))
  .finally(async () => {
    await prisma.$disconnect();
  });
