import { createClerkClient } from "@clerk/clerk-sdk-node";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "path";

// Load environment variables from .env
dotenv.config({ path: path.join(__dirname, "../../.env") });

const prisma = new PrismaClient();
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

async function syncUsers() {
    console.log("Starting Database Synchronization...");

    try {
        // 1. Fetch all users from Production Clerk
        const clerkUsers = await clerkClient.users.getUserList({
            limit: 500, // Fetch all (we only have 100)
        });

        console.log(`Found ${clerkUsers.length} users in Production Clerk.`);

        let successCount = 0;
        let skipCount = 0;

        for (const clerkUser of clerkUsers) {
            const oldClerkId = (clerkUser.publicMetadata as any)?.oldClerkId;
            const newClerkId = clerkUser.id;
            const email = clerkUser.emailAddresses[0]?.emailAddress;

            if (!oldClerkId) {
                console.log(`[SKIP] User ${email} has no oldClerkId metadata.`);
                skipCount++;
                continue;
            }

            // 2. Find user in Prisma DB by old ID and update to new ID
            const dbUser = await prisma.user.findUnique({
                where: { clerkId: oldClerkId }
            });

            if (dbUser) {
                await prisma.user.update({
                    where: { clerkId: oldClerkId },
                    data: { clerkId: newClerkId }
                });
                console.log(`[OK] Updated ${email}: ${oldClerkId} -> ${newClerkId}`);
                successCount++;
            } else {
                // Try to find by email as a fallback
                const dbUserByEmail = await prisma.user.findUnique({
                    where: { email: email }
                });

                if (dbUserByEmail) {
                    await prisma.user.update({
                        where: { email: email },
                        data: { clerkId: newClerkId }
                    });
                    console.log(`[OK] Updated by Email ${email}: -> ${newClerkId}`);
                    successCount++;
                } else {
                    console.log(`[WARN] User ${email} not found in database.`);
                }
            }
        }

        console.log("\nSynchronization finished!");
        console.log(`Updated: ${successCount}`);
        console.log(`Skipped: ${skipCount}`);

    } catch (error) {
        console.error("Error during synchronization:", error);
    } finally {
        await prisma.$disconnect();
    }
}

syncUsers();
