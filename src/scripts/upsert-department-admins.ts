import bcrypt from 'bcryptjs';
import prisma from '../config/prisma';

type DepartmentAdminSeed = {
    department: string;
    email: string;
    password: string;
};

const DEPARTMENT_ADMINS: DepartmentAdminSeed[] = [
    { department: 'CSD & ISE', email: 'csdise@envision.in', password: 'CsdIse@Env2026!' },
    { department: 'EC', email: 'ec@envision.in', password: 'EcDept@Env2026!' },
    { department: 'Marine', email: 'marine@envision.in', password: 'Marine@Env2026!' },
    { department: 'CSE', email: 'cse@envision.in', password: 'CseCore@Env2026!' },
    { department: 'Aeronautical', email: 'aeronautical@envision.in', password: 'Aero@Env2026!' },
    { department: 'EEE', email: 'eee@envision.in', password: 'EeeGrid@Env2026!' },
    { department: 'CSBS', email: 'csbs@envision.in', password: 'CsbsBiz@Env2026!' },
    { department: 'AIML', email: 'aiml@envision.in', password: 'AimlLab@Env2026!' },
    { department: 'Auto Mobile', email: 'automobile@envision.in', password: 'AutoMob@Env2026!' },
    { department: 'Mech', email: 'mech@envision.in', password: 'MechFab@Env2026!' },
];

async function main() {
    console.log('Seeding department admin accounts...');

    for (const adminSeed of DEPARTMENT_ADMINS) {
        const passwordHash = await bcrypt.hash(adminSeed.password, 10);

        await prisma.admin.upsert({
            where: { email: adminSeed.email },
            update: {
                name: `${adminSeed.department} Department Admin`,
                password_hash: passwordHash,
                is_active: true,
            },
            create: {
                email: adminSeed.email,
                name: `${adminSeed.department} Department Admin`,
                password_hash: passwordHash,
                is_active: true,
            },
        });

        console.log(`Upserted: ${adminSeed.email}`);
    }

    console.log('Done. All department admins are ready.');
}

main()
    .catch((error) => {
        console.error('Failed to seed department admins:', error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

