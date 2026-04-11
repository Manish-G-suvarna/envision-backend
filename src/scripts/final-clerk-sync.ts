import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import https from "https";

dotenv.config();

const prisma = new PrismaClient();

function httpGet(url: string, secretKey: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
        const options = {
            headers: {
                "Authorization": `Bearer ${secretKey}`,
                "Content-Type": "application/json",
            }
        };
        https.get(url, options, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(Array.isArray(parsed) ? parsed : parsed.data || []);
                } catch (e) {
                    reject(e);
                }
            });
        }).on("error", reject);
    });
}

async function syncAll() {
    console.log("--- SYNCING ALL CLERK IDS FROM PRODUCTION ---");
    const secretKey = process.env.CLERK_SECRET_KEY;
    if (!secretKey) throw new Error("CLERK_SECRET_KEY not set");

    try {
        const clerkUsers = await httpGet(
            "https://api.clerk.com/v1/users?limit=500",
            secretKey
        );
        console.log(`Found ${clerkUsers.length} users in Clerk.`);

        let updatedCount = 0;
        let skipCount = 0;

        for (const cu of clerkUsers) {
            const email = cu.email_addresses?.[0]?.email_address;
            if (!email) continue;

            const dbUser = await prisma.user.findUnique({ where: { email } });

            if (dbUser) {
                if (dbUser.clerkId !== cu.id) {
                    await prisma.user.update({
                        where: { id: dbUser.id },
                        data: { clerkId: cu.id },
                    });
                    console.log(`✅ Updated ${email}: ${dbUser.clerkId} -> ${cu.id}`);
                    updatedCount++;
                } else {
                    skipCount++;
                }
            } else {
                console.log(`ℹ️ Clerk user ${email} not found in DB.`);
            }
        }

        console.log(`\nResults: ${updatedCount} updated, ${skipCount} already correct.`);
    } catch (err) {
        console.error("Sync failed:", err);
    } finally {
        await prisma.$disconnect();
    }
}

syncAll();
