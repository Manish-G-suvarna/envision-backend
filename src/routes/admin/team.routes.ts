import { Router } from 'express';
import { listTeams } from '../../controllers/admin/team.controller';
import { verifyAdmin } from '../../middleware/auth';

const router = Router();

router.use(verifyAdmin);

router.get('/', listTeams);

export default router;
