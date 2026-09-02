import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { authenticate } from '../middleware/auth.js';
import * as AuthController from '../controllers/auth.controller.js';

const router = Router();

router.post('/signup', asyncHandler(AuthController.signup));
router.post('/login', asyncHandler(AuthController.login));
router.post('/refresh', asyncHandler(AuthController.refresh));
router.post('/logout', asyncHandler(AuthController.logout));
router.get('/me', authenticate, asyncHandler(AuthController.me));
/** Public: fetch invite info so the signup form can prefill org/role/email. */
router.get('/invite/:token', asyncHandler(AuthController.getInviteInfo));

export default router;

