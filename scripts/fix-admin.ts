import prisma from '../src/config/prisma';
import bcrypt from 'bcryptjs';

async function fixAdmin() {
  const email = process.argv[2] || 'manish.admin@envision.dev';
  const newPassword = process.argv[3] || 'AdminPassword123!';

  console.log(`🔧 Repairing integrity for admin: ${email}...`);

  try {
    const admin = await prisma.admin.findUnique({
      where: { email }
    });

    if (!admin) {
      console.error(`❌ Admin with email ${email} not found in database.`);
      process.exit(1);
    }

    const password_hash = await bcrypt.hash(newPassword, 10);

    await prisma.admin.update({
      where: { id: admin.id },
      data: { password_hash }
    });

    console.log(`✅ Integrity restored! Admin ${email} can now log in.`);
    console.log(`🔑 Password is set to: ${newPassword}`);
  } catch (error: any) {
    console.error('❌ Error repairing admin:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

fixAdmin();
