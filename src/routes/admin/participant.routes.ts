import { Router } from 'express';
import {
    listParticipants,
    getParticipantById,
    updatePaymentStatus,
    removeParticipant,
} from '../../controllers/admin/participant.controller';
import { validateRequest } from '../../middleware/validate';
import {
    listParticipantsSchema,
    getParticipantByIdSchema,
    updatePaymentStatusSchema,
    removeParticipantSchema,
} from '../../validators/admin/participant.validator';
import { verifyAdmin } from '../../middleware/auth';

const router = Router();

router.use(verifyAdmin);

router.get('/', validateRequest(listParticipantsSchema), listParticipants);
router.get('/:id', validateRequest(getParticipantByIdSchema), getParticipantById);
router.patch('/:id/payment', validateRequest(updatePaymentStatusSchema), updatePaymentStatus);
router.delete('/:id', validateRequest(removeParticipantSchema), removeParticipant);

export default router;
