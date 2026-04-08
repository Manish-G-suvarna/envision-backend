import { Router } from 'express';
import {
    listParticipants,
    getParticipantById,
    updatePaymentStatus,
} from '../../controllers/admin/participant.controller';
import { validateRequest } from '../../middleware/validate';
import {
    listParticipantsSchema,
    getParticipantByIdSchema,
    updatePaymentStatusSchema,
} from '../../validators/admin/participant.validator';
import { verifyAdmin } from '../../middleware/auth';

const router = Router();

router.use(verifyAdmin);

router.get('/', validateRequest(listParticipantsSchema), listParticipants);
router.get('/:id', validateRequest(getParticipantByIdSchema), getParticipantById);
router.patch('/:id/payment', validateRequest(updatePaymentStatusSchema), updatePaymentStatus);

export default router;
