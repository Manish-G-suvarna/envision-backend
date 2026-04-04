import http from 'http';
import fs from 'fs';
import path from 'path';
import { Server } from 'socket.io';
import app from './app';
import { env } from './config/env';
import { closeRedisClient } from './config/redis';

// Global error logging for unhandled rejections (possible cause for 'Failed to fetch')
const logCrash = (error: any, type: string) => {
    const timestamp = new Date().toISOString();
    const message = `\n[${timestamp}] ${type}: ${error?.message || error}\n${error?.stack || ''}\n`;
    try {
        fs.appendFileSync(path.join(process.cwd(), 'crash.log'), message);
        console.error(`🔥 ${type} LOGGED TO crash.log`);
    } catch (e) {
        console.error('Failed to write crash.log', e);
    }
};

process.on('unhandledRejection', (reason) => logCrash(reason, 'UNHANDLED REJECTION'));
process.on('uncaughtException', (error) => logCrash(error, 'UNCAUGHT EXCEPTION'));

const PORT = env.PORT || 5000;

const server = http.createServer(app);

export const io = new Server(server, {
    cors: {
        origin: true,
        methods: ['GET', 'POST'],
        credentials: true
    }
});

io.on('connection', (socket) => {
    console.log('👤 New client connected:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('👤 Client disconnected:', socket.id);
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📡 WebSocket server is ready`);
});

// ── Graceful Shutdown ──────────────────────────────────────────────────────
async function shutdown(signal: string) {
    console.log(`\n🛑 ${signal} received – shutting down gracefully...`);
    server.close(async () => {
        await closeRedisClient();
        console.log('✅ Server closed. Bye!');
        process.exit(0);
    });

    // Force kill if still alive after 10s
    setTimeout(() => {
        console.error('⏱️  Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
