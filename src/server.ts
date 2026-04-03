import http from 'http';
import { Server } from 'socket.io';
import app from './app';
import { env } from './config/env';
import { closeRedisClient } from './config/redis';

const HOST = '0.0.0.0';
const PORT = env.PORT || 5000;
const MAX_PORT_RETRIES = 10;

const server = http.createServer(app);

export const io = new Server(server, {
    cors: {
        origin: [
            env.FRONTEND_URL,
            'https://envisionsit.in',
            'https://envision-70i6jic1x-manish-g-suvarnas-projects-b07d8c30.vercel.app',
            'http://10.165.68.143:3000',
            'http://10.165.68.143:5000',
            'http://localhost:3000',
            'http://127.0.0.1:3000'
        ],
        methods: ['GET', 'POST'],
        credentials: true
    }
});

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

function startServer(port: number, retriesLeft = MAX_PORT_RETRIES) {
    server.once('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE' && env.NODE_ENV === 'development' && retriesLeft > 0) {
            const nextPort = port + 1;
            console.warn(`Port ${port} is busy, retrying on ${nextPort}...`);
            startServer(nextPort, retriesLeft - 1);
            return;
        }

        console.error(`Failed to start server on port ${port}:`, error);
        process.exit(1);
    });

    server.listen(port, HOST, () => {
        console.log(`Server is running on port ${port}`);
        console.log('WebSocket server is ready');
    });
}

startServer(PORT);

async function shutdown(signal: string) {
    console.log(`\n${signal} received, shutting down gracefully...`);
    server.close(async () => {
        await closeRedisClient();
        console.log('Server closed. Bye!');
        process.exit(0);
    });

    setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
