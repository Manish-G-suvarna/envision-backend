import express from 'express';
import * as registrationController from '../controllers/registration.controller';
import multer from 'multer';
import { registrationRateLimiter } from '../middleware/rateLimit';
import { requireUserAuth, verifyAdmin } from '../middleware/auth';

const upload = multer({ dest: 'uploads/' });

const router = express.Router();

router.post('/bulk-update', verifyAdmin, upload.single('file'), registrationController.bulkUpdateRegistrations);
router.post('/bulk-verify-paytm', verifyAdmin, upload.single('file'), registrationController.bulkVerifyPaytmCsv);
router.use(requireUserAuth);
router.post('/start', registrationRateLimiter, registrationController.createRegistration);
router.post('/create-with-payment', registrationRateLimiter, registrationController.createRegistrationWithPayment);
router.get('/:id', registrationController.getRegistration);
router.put('/:id/payment', registrationController.verifyPayment);
router.post('/join/:eventId', registrationController.joinTeam);
router.get('/user/by-env-id/:envId', registrationController.getUserByEnvId);

export default router;
