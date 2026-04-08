import { clerkClient } from '@clerk/express';
import prisma from '../src/config/prisma';
import bcrypt from 'bcryptjs';

async function seedAdmin() {
  console.log('🚀 Creating first admin user...\n');

  const email = 'manish.admin@envision.dev';
  const firstName = 'Manish';
  const lastName = 'Admin';
  const password = 'Env@Admin#9988!2026';

  try {
    // 1. Create user in Clerk
    console.log('📧 Creating user in Clerk...');
    const clerkUser = await clerkClient.users.createUser({
      emailAddress: [email],
      password,
      firstName,
      lastName,
      publicMetadata: {
        role: 'admin',
      },
    });

    console.log(`✓ Clerk user created: ${clerkUser.id}`);

    // 2. Hash password for local admin login
    const password_hash = await bcrypt.hash(password, 10);

    // 3. Create admin record in database
    console.log('\n💾 Creating admin record in database...');
    const admin = await prisma.admin.create({
      data: {
        clerk_user_id: clerkUser.id,
        email,
        name: `${firstName} ${lastName}`,
        password_hash,
        is_active: true,
      },
    });

    console.log(`✓ Admin record created: ID ${admin.id}`);

    // 3. Summary
    console.log('\n✅ Admin Setup Complete!\n');
    console.log('📋 Admin Credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log(`   Clerk ID: ${clerkUser.id}`);
    console.log(`   Database ID: ${admin.id}`);
    console.log('\n🔐 Security:');
    console.log('   ✓ Authenticated by Clerk');
    console.log('   ✓ Authorized in database');
    console.log('   ✓ Active status: true');
    console.log('\n🌐 Login at: http://localhost:3000/login');
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seedAdmin();
