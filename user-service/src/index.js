import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { ensureTables } from './db.js';
import usersRouter from './routes/users.js';

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is required');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('FATAL: DATABASE_URL is required');
  process.exit(1);
}

await ensureTables();

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'user-service' }));
app.use('/api', usersRouter);

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`user-service listening on :${port}`));
