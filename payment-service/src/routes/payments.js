import { Router } from 'express';
import { process, getByOrderId } from '../controllers/payments.js';
import { verifyJwt } from '../middleware/auth.js';

const router = Router();

router.post('/payments/process', verifyJwt, process);
router.get('/payments/:orderId', verifyJwt, getByOrderId);

export default router;
