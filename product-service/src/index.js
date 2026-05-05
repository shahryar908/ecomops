import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ensureTables } from './db.js';
import { seedIfEmpty } from './seed.js';
import productsRouter from './routes/products.js';

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is required');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL is required');
  process.exit(1);
}

await ensureTables();
await seedIfEmpty();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'product-service' }));
app.use('/api', productsRouter);

const port = Number(process.env.PORT ?? 3002);
app.listen(port, () => console.log(`product-service listening on :${port}`));
