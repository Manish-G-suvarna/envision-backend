import { Router } from 'express';
import { getEvents } from '../controllers/event.controller';
import { validateRequest } from '../middleware/validate';
import { getEventsQuerySchema } from '../validators/event.validator';

const router = Router();

router.get('/', validateRequest(getEventsQuerySchema), getEvents);

export default router;
