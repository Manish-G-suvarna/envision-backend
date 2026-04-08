import { clerkClient } from '@clerk/express';
import prisma from '../src/config/prisma';
import bcrypt from 'bcryptjs';

async function syncAdmin() {
  const email = 'manish.admin@envision.dev';
  const firstName = 'Manish';
  const lastName = 'Admin';
  const password = 'AdminPassword123!';

  console.log(`📡 Syncing admin account for: ${email}...\n`);

  try {
    // 1. Check if user exists in Clerk
    console.log('🔍 Checking Clerk for existing user...');
    const users = await clerkClient.users.getUserList({
      emailAddress: [email],
    });

    let clerkUser;
    if (users.data.length > 0) {
      clerkUser = users.data[0];
      console.log(`✓ Found existing Clerk user: ${clerkUser.id}`);
    } else {
      console.log('📧 User not found in Clerk. Creating new user...');
      clerkUser = await clerkClient.users.createUser({
        emailAddress: [email],
        password,
        firstName,
        lastName,
        publicMetadata: { role: 'admin' },
      });
      console.log(`✓ New Clerk user created: ${clerkUser.id}`);
    }

    // 2. Hash password for local login
    const password_hash = await bcrypt.hash(password, 10);

    // 3. Upsert into local database
    console.log('\n💾 Syncing admin record in database...');
    const admin = await prisma.admin.upsert({
      where: { email },
      update: {
        clerk_user_id: clerkUser.id,
        password_hash,
        is_active: true,
      },
      create: {
        clerk_user_id: clerkUser.id,
        email,
        name: `${firstName} ${lastName}`,
        password_hash,
        is_active: true,
      },
    });

    console.log(`✅ Admin record synced: ID ${admin.id}`);
    console.log('\n🔐 Credentials:');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log('\n🚀 You can now log in at /admin/login');

  } catch (error: any) {
    console.error('❌ Error syncing admin:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

syncAdmin();
