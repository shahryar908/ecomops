import { Router } from 'express';
import { create, list, getOne } from '../controllers/orders.js';
import { verifyJwt } from '../middleware/auth.js';

const router = Router();

router.use(verifyJwt);

router.post('/orders', create);
router.get('/orders', list);
router.get('/orders/:id', getOne);

export default router;
