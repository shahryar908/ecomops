import { Router } from 'express';
import { register, login, profile, getById } from '../controllers/users.js';
import { verifyJwt } from '../middleware/auth.js';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/profile', verifyJwt, profile);
router.get('/users/:id', verifyJwt, getById);

export default router;
