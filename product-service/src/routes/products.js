import { Router } from 'express';
import { list, getOne, create, decrementStock } from '../controllers/products.js';
import { verifyJwt, requireRole } from '../middleware/auth.js';

const router = Router();

router.get('/products', list);
router.get('/products/:id', getOne);
router.post('/products', verifyJwt, requireRole('admin'), create);
router.put('/products/:id/stock', verifyJwt, decrementStock);

export default router;
