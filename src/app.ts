import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { clerkMiddleware } from '@clerk/express';
import { env } from './config/env';
import { globalRateLimiter } from './middleware/rateLimit';

// Route imports
import eventRoutes from './routes/event.routes';
import userRoutes from './routes/user.routes';
import registrationRoutes from './routes/registration.routes';
import testRoutes from './routes/test.routes';
import adminAuthRoutes from './routes/admin/auth.routes';
import adminDashboardRoutes from './routes/admin/dashboard.routes';
import adminParticipantRoutes from './routes/admin/participant.routes';
import adminEventRoutes from './routes/admin/event.routes';
import adminManageRoutes from './routes/admin/admin.routes';

const app = express();

// Trust NGINX reverse proxy — required for correct IP-based rate limiting in production
// Without this, all clients behind the proxy appear as 127.0.0.1 and share one rate bucket
app.set('trust proxy', 1);

// Security headers
app.use(helmet());

// Global rate limiting
app.use('/api', globalRateLimiter);

// CORS configuration
app.use(cors({
    origin: (origin, callback) => {
        // In development, allow all origins for easy mobile/LAN testing
        if (process.env.NODE_ENV === 'development' || !origin) {
            return callback(null, true);
        }
        
        const allowedOrigins = [
            env.FRONTEND_URL, 
            'https://envisionsit.in', 
            'https://envision-70i6jic1x-manish-g-suvarnas-projects-b07d8c30.vercel.app',
            'http://127.0.0.1:3000', 
            'http://localhost:3000',
            'http://localhost:3001',
            'http://10.165.68.143:3001'
        ];
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));

// Body parsing with payload size limits
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Clerk auth context for protected admin routes
if (env.CLERK_SECRET_KEY) {
    app.use(clerkMiddleware());
}

// Health Check
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Backend is running' });
});

// Public Routes
app.use('/api/v1/events', eventRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/registrations', registrationRoutes);
app.use('/api/v1/test', testRoutes);

// Admin Routes
app.use('/api/v1/admin/auth', adminAuthRoutes);
app.use('/api/v1/admin/dashboard', adminDashboardRoutes);
app.use('/api/v1/admin/participants', adminParticipantRoutes);
app.use('/api/v1/admin/events', adminEventRoutes);
app.use('/api/v1/admin/manage', adminManageRoutes);

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error'
    });
});

export default app;
