import { Router } from 'express';
import {
    createAdmin,
    deleteAdmin,
    listAdmins,
    resetAdminPassword,
    updateAdminStatus,
} from '../../controllers/admin/admin.controller';
import { requireMainAdmin, verifyAdmin } from '../../middleware/auth';
import { validateRequest } from '../../middleware/validate';
import {
    createAdminSchema,
    deleteAdminSchema,
    listAdminsSchema,
    resetAdminPasswordSchema,
    updateAdminStatusSchema,
} from '../../validators/admin/admin.validator';

const router = Router();

router.use(verifyAdmin);
router.use(requireMainAdmin);

router.get('/', validateRequest(listAdminsSchema), listAdmins);
router.post('/', validateRequest(createAdminSchema), createAdmin);
router.patch('/:id/status', validateRequest(updateAdminStatusSchema), updateAdminStatus);
router.patch('/:id/password', validateRequest(resetAdminPasswordSchema), resetAdminPassword);
router.delete('/:id', validateRequest(deleteAdminSchema), deleteAdmin);

export default router;
