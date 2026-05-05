import { Router } from 'express';
import { add, list, remove, clear } from '../controllers/cart.js';
import { verifyJwt } from '../middleware/auth.js';

const router = Router();

router.use(verifyJwt);

router.post('/cart/add', add);
router.get('/cart', list);
router.delete('/cart/clear', clear);
router.delete('/cart/:productId', remove);

export default router;
