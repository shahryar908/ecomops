import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ensureTables } from './db.js';
import cartRouter from './routes/cart.js';

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is required');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL is required');
  process.exit(1);
}
if (!process.env.PRODUCT_SERVICE_URL) {
  console.error('FATAL: PRODUCT_SERVICE_URL is required');
  process.exit(1);
}

await ensureTables();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'cart-service' }));
app.use('/api', cartRouter);

const port = Number(process.env.PORT ?? 3003);
app.listen(port, () => console.log(`cart-service listening on :${port}`));
