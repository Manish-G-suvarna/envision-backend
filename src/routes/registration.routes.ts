import express from 'express';
import * as registrationController from '../controllers/registration.controller';
import multer from 'multer';
import { registrationRateLimiter } from '../middleware/rateLimit';

const upload = multer({ dest: 'uploads/' });

const router = express.Router();

router.post('/start', registrationController.createRegistration);
router.post('/create-with-payment', registrationController.createRegistrationWithPayment);
router.post('/bulk-update', upload.single('file'), registrationController.bulkUpdateRegistrations);
router.get('/:id', registrationController.getRegistration);
router.put('/:id/payment', registrationController.verifyPayment);
router.post('/join/:eventId', registrationController.joinTeam);
router.get('/user/by-env-id/:envId', registrationController.getUserByEnvId);

export default router;
