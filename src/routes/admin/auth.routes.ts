import { Router } from 'express';
import { getCurrentAdmin, loginAdmin, loginAdminWithClerk } from '../../controllers/admin/auth.controller';
import { verifyAdmin } from '../../middleware/auth';
import { authRateLimiter } from '../../middleware/rateLimit';

const router = Router();

// Login (Public - stricter rate limit: 10 attempts / 15 min)
router.post('/login', authRateLimiter, loginAdmin);
router.post('/clerk-login', authRateLimiter, loginAdminWithClerk);

// Get current admin profile (Protected)
router.get('/me', verifyAdmin as any, getCurrentAdmin as any);

export default router;
