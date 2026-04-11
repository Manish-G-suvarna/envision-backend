import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "../../.env") });

const prisma = new PrismaClient();

async function verify() {
    console.log("--- NEON DATABASE VERIFICATION ---");
    try {
        const userCount = await prisma.user.count();
        const eventCount = await prisma.event.count();
        const regCount = await prisma.registration.count();
        const deptCount = await prisma.department.count();

        console.log(`Departments: ${deptCount}`);
        console.log(`Events:      ${eventCount}`);
        console.log(`Users:       ${userCount}`);
        console.log(`Registrations: ${regCount}`);

        console.log("\nSample User (Linked to Clerk):");
        const sampleUser = await prisma.user.findFirst({
            where: { clerkId: { startsWith: 'user_' } },
            select: { email: true, clerkId: true }
        });
        console.log(sampleUser);

        console.log("\nSample Registration:");
        const sampleReg = await prisma.registration.findFirst({
            include: { user: true }
        });
        console.log(sampleReg ? { id: sampleReg.id, email: sampleReg.user.email, status: sampleReg.payment_status } : "No registrations found");

    } catch (err) {
        console.error("Verification failed:", err);
    } finally {
        await prisma.$disconnect();
    }
}

verify();
