import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ensureTables } from './db.js';
import ordersRouter from './routes/orders.js';

const required = ['JWT_SECRET', 'DATABASE_URL', 'CART_SERVICE_URL', 'PRODUCT_SERVICE_URL', 'PAYMENT_SERVICE_URL'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`FATAL: ${key} is required`);
    process.exit(1);
  }
}

await ensureTables();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'order-service' }));
app.use('/api', ordersRouter);

const port = Number(process.env.PORT ?? 3004);
app.listen(port, () => console.log(`order-service listening on :${port}`));
