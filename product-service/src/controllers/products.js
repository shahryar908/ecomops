import { and, eq, gte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db.js';
import { products } from '../schema.js';

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  price: z.number().nonnegative(),
  stock: z.number().int().nonnegative(),
  imageUrl: z.string().url().optional(),
});

const stockSchema = z.object({
  quantity: z.number().int().refine((n) => n !== 0, { message: 'must be non-zero' }),
});

export async function list(_req, res) {
  const rows = await db.select().from(products);
  res.json({ products: rows });
}

export async function getOne(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
  const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!row) return res.status(404).json({ error: 'Product not found' });
  res.json({ product: row });
}

export async function create(req, res) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { name, description, price, stock, imageUrl } = parsed.data;

  const [row] = await db.insert(products).values({
    name,
    description: description ?? '',
    price,
    stock,
    imageUrl: imageUrl ?? '',
  }).returning();

  res.status(201).json({ product: row });
}

export async function decrementStock(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  const parsed = stockSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { quantity } = parsed.data;

  const [existing] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  const where = quantity > 0
    ? and(eq(products.id, id), gte(products.stock, quantity))
    : eq(products.id, id);

  const [row] = await db.update(products)
    .set({ stock: sql`${products.stock} - ${quantity}` })
    .where(where)
    .returning();

  if (!row) return res.status(409).json({ error: 'Insufficient stock', stock: existing.stock });
  res.json({ product: row });
}
