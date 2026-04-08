import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

function csvEscape(value: unknown): string {
  const text = String(value ?? '');
  if (text.includes('"') || text.includes(',') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

async function main() {
  const registrations = await prisma.registration.findMany({
    include: {
      user: true,
      events: {
        include: {
          event: true,
          members: true,
        },
      },
    },
    orderBy: { created_at: 'desc' },
  });

  const outputDir = path.join(process.cwd(), 'exports');
  fs.mkdirSync(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(outputDir, `registrations-full-${timestamp}.json`);
  const csvPath = path.join(outputDir, `registrations-full-${timestamp}.csv`);

  const normalized = registrations.map((registration) => ({
    registrationId: registration.id,
    paymentStatus: registration.payment_status,
    totalAmount: Number(registration.total_amount),
    utrId: registration.utr_id,
    createdAt: registration.created_at,
    student: {
      id: registration.user.id,
      name: registration.user.name,
      email: registration.user.email,
      phone: registration.user.phone,
      college: registration.user.college,
      department: registration.user.department,
      degree: registration.user.degree,
      usn: registration.user.usn,
      envId: registration.user.env_id,
    },
    events: registration.events.map((eventEntry) => ({
      registrationEventId: eventEntry.id,
      eventId: eventEntry.event_id,
      eventName: eventEntry.event.event_name,
      fee: Number(eventEntry.event.fee),
      teamName: eventEntry.team_name,
      members: eventEntry.members.map((member) => ({
        id: member.id,
        name: member.name,
        envId: member.env_id,
        isLeader: member.is_leader,
        userId: member.user_id,
      })),
    })),
  }));

  fs.writeFileSync(jsonPath, JSON.stringify(normalized, null, 2), 'utf8');

  const csvRows = [
    [
      'registration_id',
      'payment_status',
      'total_amount',
      'utr_id',
      'created_at',
      'student_name',
      'student_email',
      'student_phone',
      'student_college',
      'student_department',
      'student_degree',
      'student_usn',
      'student_env_id',
      'event_name',
      'event_fee',
      'team_name',
      'member_names',
      'member_env_ids',
    ],
    ...normalized.flatMap((registration) =>
      registration.events.map((eventEntry) => [
        registration.registrationId,
        registration.paymentStatus,
        registration.totalAmount,
        registration.utrId ?? '',
        registration.createdAt.toISOString(),
        registration.student.name,
        registration.student.email,
        registration.student.phone ?? '',
        registration.student.college,
        registration.student.department ?? '',
        registration.student.degree ?? '',
        registration.student.usn ?? '',
        registration.student.envId ?? '',
        eventEntry.eventName,
        eventEntry.fee,
        eventEntry.teamName ?? '',
        eventEntry.members.map((member) => member.name).join(' | '),
        eventEntry.members.map((member) => member.envId).join(' | '),
      ])
    ),
  ];

  const csv = csvRows.map((row) => row.map(csvEscape).join(',')).join('\n');
  fs.writeFileSync(csvPath, csv, 'utf8');

  console.log(`Exported ${normalized.length} registrations.`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`CSV: ${csvPath}`);
}

main()
  .catch((error) => {
    console.error('Failed to export complete registrations:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
