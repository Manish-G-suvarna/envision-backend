import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@envision.in';
    const password = '#Envisionsit2026';
    const name = 'Envision Admin';

    console.log(`🔐 UPSERTING ADMIN: ${email}...`);

    try {
        const passwordHash = await bcrypt.hash(password, 10);

        const admin = await prisma.admin.upsert({
            where: { email },
            update: {
                password_hash: passwordHash,
                name: name,
                is_active: true
            },
            create: {
                email,
                name,
                password_hash: passwordHash,
                is_active: true
            },
        });

        console.log('✅ ADMIN READY. COMMAND CENTER ACCESS AUTHORIZED.');
        console.log('Admin ID:', admin.id);
    } catch (error) {
        console.error('❌ UPSERT FAILED:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
