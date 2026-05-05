import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db.js';
import { payments } from '../schema.js';

const processSchema = z.object({
  orderId: z.number().int().positive(),
  amount: z.number().positive(),
});

export async function process(req, res) {
  const parsed = processSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { orderId, amount } = parsed.data;

  const success = Math.random() < 0.9;
  const status = success ? 'success' : 'failed';
  const transactionId = randomUUID();

  const [row] = await db.insert(payments).values({
    orderId,
    amount,
    status,
    transactionId,
  }).returning();

  res.status(success ? 200 : 402).json({ payment: row });
}

export async function getByOrderId(req, res) {
  const orderId = Number(req.params.orderId);
  if (!Number.isInteger(orderId)) return res.status(400).json({ error: 'Invalid orderId' });
  const [row] = await db.select().from(payments).where(eq(payments.orderId, orderId)).limit(1);
  if (!row) return res.status(404).json({ error: 'Payment not found' });
  res.json({ payment: row });
}
