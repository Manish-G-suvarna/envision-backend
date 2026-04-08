import { Router } from 'express';
import {
    listEvents,
    getEventById,
    getEventStats,
    getEventRegistrationDetails,
    updateEventStatus,
    closeAllEvents,
    openAllEvents,
} from '../../controllers/admin/event.controller';
import { validateRequest } from '../../middleware/validate';
import { listEventsSchema, idParamSchema, updateEventStatusSchema } from '../../validators/admin/event.validator';
import { verifyAdmin } from '../../middleware/auth';

const router = Router();

router.use(verifyAdmin);

router.get('/', validateRequest(listEventsSchema), listEvents);
router.put('/close-all', closeAllEvents);
router.put('/open-all', openAllEvents);
router.get('/:id/registrations', validateRequest(idParamSchema), getEventRegistrationDetails);
router.get('/:id', validateRequest(idParamSchema), getEventById);
router.get('/:id/stats', validateRequest(idParamSchema), getEventStats);
router.put('/:id/status', validateRequest(updateEventStatusSchema), updateEventStatus);

export default router;
