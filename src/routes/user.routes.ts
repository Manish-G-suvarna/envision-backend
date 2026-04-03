import express from 'express';
import * as userController from '../controllers/user.controller';

const router = express.Router();

router.post('/check', userController.checkUser);
router.post('/onboard', userController.onboardUser);
router.get('/profile/:clerkId', userController.getProfile);

export default router;
