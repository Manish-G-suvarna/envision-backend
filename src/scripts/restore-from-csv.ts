import { createClerkClient } from "@clerk/clerk-sdk-node";
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "../../.env") });

const prisma = new PrismaClient();
const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY as string });

const DATA_DIR = path.join(__dirname, "../../all data");

async function restore() {
    console.log("Starting Full Data Restoration...");

    try {
        // 1. Map Clerk Emails to NEW IDs
        console.log("Fetching Production Clerk users...");
        const clerkUsersList = await clerkClient.users.getUserList({ limit: 500 });
        const emailToNewClerkId: Record<string, string> = {};
        for (const u of (clerkUsersList as any)) {
            if (u.emailAddresses && u.emailAddresses[0]) {
                const email = u.emailAddresses[0].emailAddress;
                emailToNewClerkId[email.toLowerCase()] = u.id;
            }
        }
        console.log(`Mapped ${Object.keys(emailToNewClerkId).length} production Clerk users.`);

        const readCsv = (filename: string) => {
            const filePath = path.join(DATA_DIR, filename);
            if (!fs.existsSync(filePath)) {
                console.warn(`[WARN] File not found: ${filename}`);
                return [];
            }
            const content = fs.readFileSync(filePath, "utf-8");
            return parse(content, { columns: true, skip_empty_lines: true });
        };

        // 2. Import Departments
        console.log("Importing Departments...");
        const departments = readCsv("public-Department-selection.csv");
        for (const d of (departments as any[])) {
            await prisma.department.upsert({
                where: { id: parseInt(d.id) },
                update: {},
                create: {
                    id: parseInt(d.id),
                    department_name: d.department_name,
                    created_at: d.created_at ? new Date(d.created_at) : new Date(),
                },
            });
        }

        // 3. Import Events
        console.log("Importing Events...");
        const events = readCsv("public-Event-selection.csv");
        for (const e of (events as any[])) {
            await prisma.event.upsert({
                where: { id: parseInt(e.id) },
                update: {},
                create: {
                    id: parseInt(e.id),
                    event_name: e.event_name,
                    japanese_name: e.japanese_name,
                    description: e.description,
                    overview: e.overview,
                    image_url: e.image_url,
                    day: e.day ? parseInt(e.day) : null,
                    time: e.time,
                    venue: e.venue,
                    fee: parseFloat(e.fee),
                    event_type: e.event_type.replace("-", "_") as any,
                    is_mega_event: e.is_mega_event === "true",
                    is_team_event: e.is_team_event === "true",
                    team_min_size: e.team_min_size ? parseInt(e.team_min_size) : null,
                    team_max_size: e.team_max_size ? parseInt(e.team_max_size) : null,
                    department_id: parseInt(e.department_id),
                    status: e.status as any,
                    created_at: new Date(e.created_at),
                },
            });
        }

        // 4. Import Event Children (Rules, Rounds, Criteria)
        const importChildren = async (file: string, table: any, mapper: any) => {
            console.log(`Importing ${file}...`);
            const items = readCsv(file);
            for (const item of (items as any[])) {
                try {
                    await table.upsert({
                        where: { id: parseInt(item.id) },
                        update: {},
                        create: mapper(item),
                    });
                } catch (err) {
                    console.warn(`[WARN] Failed to import ${file} ID ${item.id}:`, (err as Error).message);
                }
            }
        };

        await importChildren("public-Rule-selection.csv", prisma.rule, (i: any) => ({
            id: parseInt(i.id),
            event_id: parseInt(i.event_id),
            content: i.content,
        }));

        await importChildren("public-Round-selection.csv", prisma.round, (i: any) => ({
            id: parseInt(i.id),
            event_id: parseInt(i.event_id),
            round_number: parseInt(i.round_number),
            name: i.name,
            format: i.format,
            evaluation: i.evaluation,
            duration: i.duration,
        }));

        await importChildren("public-JudgingCriteria-selection.csv", prisma.judgingCriteria, (i: any) => ({
            id: parseInt(i.id),
            event_id: parseInt(i.event_id),
            content: i.content,
        }));

        // 5. Import Users (Mapping Clerk IDs)
        console.log("Importing Users...");
        const users = readCsv("public-User-selection.csv");
        for (const u of (users as any[])) {
            const email = u.email.toLowerCase();
            const newClerkId = emailToNewClerkId[email];

            if (!newClerkId) {
                console.warn(`[WARN] User ${email} not found in production Clerk. Skipping.`);
                continue;
            }

            await prisma.user.upsert({
                where: { id: parseInt(u.id) },
                update: {},
                create: {
                    id: parseInt(u.id),
                    name: u.name,
                    email: u.email,
                    clerkId: newClerkId,
                    phone: u.phone,
                    college: u.college,
                    degree: u.degree,
                    department: u.department,
                    usn: u.usn,
                    year: u.year,
                    gender: u.gender,
                    branch: u.branch,
                    is_onboarded: u.is_onboarded === "true",
                    env_id: u.env_id,
                    createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
                    updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(),
                },
            });
        }

        // 6. Import Admins
        console.log("Importing Admins...");
        const admins = readCsv("public-Admin-selection.csv");
        for (const a of (admins as any[])) {
            await prisma.admin.upsert({
                where: { id: parseInt(a.id) },
                update: {},
                create: {
                    id: parseInt(a.id),
                    name: a.name,
                    email: a.email,
                    password_hash: a.password_hash,
                    is_active: a.is_active === "true",
                    clerk_user_id: a.clerk_user_id || null,
                    created_at: new Date(a.created_at),
                    updated_at: new Date(a.updated_at),
                },
            });
        }

        // 7. Import Registrations
        console.log("Importing Registrations...");
        const registrations = readCsv("public-Registration-selection.csv");
        for (const r of (registrations as any[])) {
            const userExists = await prisma.user.findUnique({ where: { id: parseInt(r.user_id) } });
            if (!userExists) {
                console.warn(`[WARN] Skipping registration ${r.id} because user ${r.user_id} was not imported.`);
                continue;
            }

            await prisma.registration.upsert({
                where: { id: parseInt(r.id) },
                update: {},
                create: {
                    id: parseInt(r.id),
                    user_id: parseInt(r.user_id),
                    total_amount: parseFloat(r.total_amount),
                    payment_status: r.payment_status,
                    utr_id: r.utr_id,
                    created_at: new Date(r.created_at),
                    updated_at: new Date(r.updated_at),
                },
            });
        }

        // 8. Import RegistrationEvents
        console.log("Importing RegistrationEvents...");
        const regEvents = readCsv("public-RegistrationEvent-selection.csv");
        for (const re of (regEvents as any[])) {
            const regExists = await prisma.registration.findUnique({ where: { id: parseInt(re.registration_id) } });
            if (!regExists) continue;

            await prisma.registrationEvent.upsert({
                where: { id: parseInt(re.id) },
                update: {},
                create: {
                    id: parseInt(re.id),
                    registration_id: parseInt(re.registration_id),
                    event_id: parseInt(re.event_id),
                    team_name: re.team_name,
                },
            });
        }

        // 9. Import RegistrationMembers
        console.log("Importing RegistrationMembers...");
        const regMembers = readCsv("public-RegistrationMember-selection.csv");
        for (const rm of (regMembers as any[])) {
            const regEventExists = await prisma.registrationEvent.findUnique({ where: { id: parseInt(rm.registration_event_id) } });
            if (!regEventExists) continue;

            await prisma.registrationMember.upsert({
                where: { id: parseInt(rm.id) },
                update: {},
                create: {
                    id: parseInt(rm.id),
                    registration_event_id: parseInt(rm.registration_event_id),
                    user_id: rm.user_id ? parseInt(rm.user_id) : null,
                    env_id: rm.env_id,
                    name: rm.name,
                    is_leader: rm.is_leader === "true",
                },
            });
        }

        // 10. Import VerifiedTransactions
        console.log("Importing VerifiedTransactions...");
        const transactions = readCsv("public-VerifiedTransaction-selection.csv");
        for (const t of (transactions as any[])) {
            await prisma.verifiedTransaction.upsert({
                where: { id: parseInt(t.id) },
                update: {},
                create: {
                    id: parseInt(t.id),
                    utr_id: t.utr_id,
                    amount: parseFloat(t.amount),
                    status: t.status,
                    processed: t.processed === "true",
                    created_at: new Date(t.created_at),
                    updated_at: new Date(t.updated_at),
                },
            });
        }

        console.log("\nRestoration successfully finished!");

    } catch (error) {
        console.error("Restoration failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

restore();
