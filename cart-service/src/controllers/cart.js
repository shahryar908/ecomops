import axios from 'axios';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db.js';
import { cartItems } from '../schema.js';

const addSchema = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().int().positive(),
});

async function fetchProduct(productId, authHeader) {
  const url = `${process.env.PRODUCT_SERVICE_URL}/api/products/${productId}`;
  const headers = authHeader ? { Authorization: authHeader } : {};
  const { data } = await axios.get(url, { headers, timeout: 5000 });
  return data.product;
}

export async function add(req, res) {
  const parsed = addSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { productId, quantity } = parsed.data;
  const userId = req.user.userId;

  let product;
  try {
    product = await fetchProduct(productId, req.headers.authorization);
  } catch (err) {
    if (err.response?.status === 404) {
      return res.status(404).json({ error: 'Product not found' });
    }
    console.error('product-service call failed', err.message);
    return res.status(502).json({ error: 'Could not validate product' });
  }

  if (product.stock < quantity) {
    return res.status(409).json({ error: 'Insufficient stock', stock: product.stock });
  }

  const [existing] = await db.select().from(cartItems)
    .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)))
    .limit(1);

  let row;
  if (existing) {
    [row] = await db.update(cartItems)
      .set({ quantity: existing.quantity + quantity, priceAtAdd: product.price })
      .where(eq(cartItems.id, existing.id))
      .returning();
  } else {
    [row] = await db.insert(cartItems).values({
      userId,
      productId,
      quantity,
      priceAtAdd: product.price,
    }).returning();
  }

  res.status(201).json({ item: row });
}

export async function list(req, res) {
  const userId = req.user.userId;
  const items = await db.select().from(cartItems).where(eq(cartItems.userId, userId));

  const enriched = await Promise.all(items.map(async (item) => {
    try {
      const product = await fetchProduct(item.productId, req.headers.authorization);
      return { ...item, product };
    } catch {
      return { ...item, product: null };
    }
  }));

  const total = enriched.reduce((sum, i) => sum + i.priceAtAdd * i.quantity, 0);
  res.json({ items: enriched, total: Number(total.toFixed(2)) });
}

export async function remove(req, res) {
  const productId = Number(req.params.productId);
  if (!Number.isInteger(productId)) return res.status(400).json({ error: 'Invalid productId' });

  const userId = req.user.userId;
  const result = await db.delete(cartItems)
    .where(and(eq(cartItems.userId, userId), eq(cartItems.productId, productId)))
    .returning();

  if (result.length === 0) return res.status(404).json({ error: 'Item not in cart' });
  res.status(204).end();
}

export async function clear(req, res) {
  const userId = req.user.userId;
  await db.delete(cartItems).where(eq(cartItems.userId, userId));
  res.status(204).end();
}
