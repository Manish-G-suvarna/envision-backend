import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import cron from 'node-cron';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

// ─── SMTP Configuration ───────────────────────────────────────────────────────
// Fill in your SMTP credentials below (Gmail / Hostinger Mail / any provider)
const SMTP_CONFIG = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false, // true for port 465, false for 587
    auth: {
        user: process.env.SMTP_USER || 'your-email@gmail.com',
        pass: process.env.SMTP_PASS || 'your-app-password',
    },
};

const FROM_EMAIL = process.env.SMTP_USER || 'your-email@gmail.com';
const FROM_NAME = 'Team Envision 2026';

// ─── Email Content ────────────────────────────────────────────────────────────
const getEmailHtml = (name: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Envision 2026 - You're Registered!</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #0a0a0a; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 0 auto; background: #111; border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #8B0000, #FF4500); padding: 40px 30px; text-align: center; }
    .header img { width: 80px; margin-bottom: 15px; }
    .header h1 { color: #fff; font-size: 32px; margin: 0; letter-spacing: 4px; font-weight: 900; }
    .header p { color: rgba(255,255,255,0.8); font-size: 13px; letter-spacing: 2px; margin: 5px 0 0; }
    .body { padding: 35px 30px; color: #e0e0e0; line-height: 1.8; }
    .body h2 { color: #FF6600; font-size: 18px; margin-bottom: 5px; }
    .body p { font-size: 15px; color: #ccc; }
    .highlight { background: rgba(255,100,0,0.1); border-left: 3px solid #FF4500; padding: 15px 20px; border-radius: 0 8px 8px 0; margin: 20px 0; }
    .highlight p { margin: 5px 0; font-size: 15px; }
    .cta { text-align: center; margin: 30px 0; }
    .cta a { background: linear-gradient(135deg, #FF4500, #8B0000); color: #fff; padding: 14px 36px; border-radius: 30px; text-decoration: none; font-weight: bold; font-size: 15px; letter-spacing: 1px; }
    .footer { text-align: center; padding: 25px 20px; color: #555; font-size: 12px; border-top: 1px solid #222; }
    .footer strong { color: #FF4500; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>ENVISION 2026</h1>
      <p>NATIONAL LEVEL TECHNO-CULTURAL FEST</p>
    </div>
    <div class="body">
      <h2>Dear ${name},</h2>
      <p>Greetings from <strong style="color:#FF6600">Srinivas Institute of Technology, Mangaluru!</strong></p>
      <p>Thank you for registering for <strong>Envision 2026</strong>, our National-Level Techno-Cultural Fest scheduled on <strong>April 16th and 17th, 2026</strong>. 🎉</p>
      <p>We are delighted to have your participation in this exciting celebration of innovation, talent, and creativity. The event will feature technical competitions, non-technical events, cultural performances, DJ night, and engaging activities designed to provide a memorable experience for all participants.</p>
      
      <div class="highlight">
        <p>📍 <strong>Venue:</strong> Srinivas Institute of Technology, Mangaluru</p>
        <p>📅 <strong>Dates:</strong> April 16 & 17, 2026</p>
      </div>

      <p>🌐 The official website is now <strong>LIVE!</strong> Share it and bring in maximum participation:</p>
      
      <div class="cta">
        <a href="https://envisionsit.in">Visit envisionsit.in →</a>
      </div>

      <p>We look forward to your enthusiastic participation and wish you the very best for the competitions! 🚀</p>
      <p>For any queries, feel free to contact the organizing team.</p>
      <br>
      <p>Warm regards,<br>
      <strong style="color:#FF6600">Team Envision 2026</strong><br>
      Srinivas Institute of Technology, Mangaluru</p>
    </div>
    <div class="footer">
      <p><strong>ENVISION 2026</strong> | Srinivas Institute of Technology | Valachil, Mangaluru</p>
      <p>📧 envisionsit.in | 📸 @envisionsit</p>
    </div>
  </div>
</body>
</html>
`;

const getEmailText = (name: string) => `
Dear ${name},

Greetings from Srinivas Institute of Technology, Mangaluru!

Thank you for registering for Envision 2026, our National-Level Techno-Cultural Fest scheduled on April 16th and 17th, 2026. 🎉

We are delighted to have your participation in this exciting celebration of innovation, talent, and creativity. The event will feature technical competitions, non-technical events, cultural performances, DJ night, and engaging activities.

📍 Venue: Srinivas Institute of Technology, Mangaluru
📅 Dates: April 16 & 17, 2026

🌐 ENVISION 2026 Website is Now Live! 🥳
https://envisionsit.in/

It's time to share it widely and bring in maximum participation. Kindly circulate the link across your networks and encourage registrations.

We look forward to your enthusiastic participation and wish you the very best for the competitions! 🚀

For any queries, feel free to contact the Envision 2026 organizing team.

Warm regards,
Team Envision 2026
Srinivas Institute of Technology, Mangaluru
`;

// ─── Send Emails ─────────────────────────────────────────────────────────────
async function sendBulkEmails() {
    console.log('📧 Starting bulk email send for Envision 2026...');

    const transporter = nodemailer.createTransport(SMTP_CONFIG);

    // Verify SMTP connection first
    try {
        await transporter.verify();
        console.log('✅ SMTP connection verified');
    } catch (err) {
        console.error('❌ SMTP connection failed:', err);
        return;
    }

    // Fetch all onboarded users with emails
    const users = await prisma.user.findMany({
        where: { is_onboarded: true },
        select: { email: true, name: true },
    });

    console.log(`📋 Found ${users.length} users to email`);

    let successCount = 0;
    let failCount = 0;

    for (const user of users) {
        try {
            await transporter.sendMail({
                from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
                to: user.email,
                subject: '🎉 You\'re Registered for Envision 2026 | Website Now Live!',
                text: getEmailText(user.name),
                html: getEmailHtml(user.name),
            });
            console.log(`✅ Sent to ${user.email}`);
            successCount++;

            // Small delay to avoid rate limits (500ms between emails)
            await new Promise(r => setTimeout(r, 500));
        } catch (err) {
            console.error(`❌ Failed for ${user.email}:`, err);
            failCount++;
        }
    }

    console.log(`\n📊 Done! ✅ ${successCount} sent, ❌ ${failCount} failed`);
    await prisma.$disconnect();
}

// ─── Run Mode ─────────────────────────────────────────────────────────────────
// Change 'now' to 'cron' if you want to schedule it
const MODE = process.argv[2] || 'now';

if (MODE === 'now') {
    // Send immediately
    sendBulkEmails().catch(console.error);
} else if (MODE === 'cron') {
    // Schedule: run once at a specific time (e.g., today at 4:00 PM IST)
    // Cron format: second minute hour day month weekday
    const schedule = process.env.EMAIL_CRON || '0 30 10 11 4 *'; // 4:00 PM IST = 10:30 UTC
    console.log(`⏰ Cron scheduled: ${schedule}`);
    cron.schedule(schedule, () => {
        sendBulkEmails().catch(console.error);
    });
}
