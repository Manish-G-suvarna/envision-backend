import { Router } from 'express';
import { getDashboardStats, getAllStudents, getAllPayments } from '../../controllers/admin/dashboard.controller';
import { validateRequest } from '../../middleware/validate';
import { dashboardStatsSchema, getAllStudentsSchema, getAllPaymentsSchema } from '../../validators/admin/dashboard.validator';
import { verifyAdmin } from '../../middleware/auth';

const router = Router();

router.use(verifyAdmin);

router.get('/', validateRequest(dashboardStatsSchema), getDashboardStats);
router.get('/students', validateRequest(getAllStudentsSchema), getAllStudents);
router.get('/payments', validateRequest(getAllPaymentsSchema), getAllPayments);

export default router;
