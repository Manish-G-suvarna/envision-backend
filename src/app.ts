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

// Security headers - Temporarily relaxed for local network diagnostic
app.use(helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
}));

// Global rate limiting
app.use('/api', globalRateLimiter);

// CORS configuration - Allow ALL in development for mobile/LAN testing
app.use(cors({
    origin: true,
    credentials: true,
}));

// Body parsing with increased payload size limits for complex team registrations
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(clerkMiddleware());

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
