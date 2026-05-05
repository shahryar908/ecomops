import axios from 'axios';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db.js';
import { orders, orderItems } from '../schema.js';

const TIMEOUT = 5000;

function authedClient(authHeader) {
  return axios.create({
    timeout: TIMEOUT,
    headers: { Authorization: authHeader },
  });
}

export async function create(req, res) {
  const userId = req.user.userId;
  const auth = req.headers.authorization;
  const http = authedClient(auth);

  let cartItems;
  try {
    const { data } = await http.get(`${process.env.CART_SERVICE_URL}/api/cart`);
    cartItems = data.items;
  } catch (err) {
    console.error('cart fetch failed', err.message);
    return res.status(502).json({ error: 'Could not load cart' });
  }

  if (!cartItems || cartItems.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }

  for (const item of cartItems) {
    if (!item.product) {
      return res.status(409).json({ error: `Product ${item.productId} no longer available` });
    }
  }

  const decremented = [];
  for (const item of cartItems) {
    try {
      await http.put(
        `${process.env.PRODUCT_SERVICE_URL}/api/products/${item.productId}/stock`,
        { quantity: item.quantity },
      );
      decremented.push(item);
    } catch (err) {
      console.error('stock decrement failed', err.response?.data ?? err.message);
      for (const reverted of decremented) {
        try {
          await http.put(
            `${process.env.PRODUCT_SERVICE_URL}/api/products/${reverted.productId}/stock`,
            { quantity: -reverted.quantity },
          );
        } catch (revertErr) {
          console.error('stock revert failed for product', reverted.productId, revertErr.message);
        }
      }
      const status = err.response?.status === 409 ? 409 : 502;
      return res.status(status).json({
        error: err.response?.data?.error ?? 'Stock reservation failed',
        productId: item.productId,
      });
    }
  }

  const total = Number(
    cartItems.reduce((s, i) => s + i.priceAtAdd * i.quantity, 0).toFixed(2),
  );

  const [order] = await db.insert(orders).values({
    userId,
    total,
    status: 'pending',
  }).returning();

  await db.insert(orderItems).values(cartItems.map((item) => ({
    orderId: order.id,
    productId: item.productId,
    name: item.product.name,
    quantity: item.quantity,
    price: item.priceAtAdd,
  })));

  let paymentResult;
  try {
    const { data } = await http.post(
      `${process.env.PAYMENT_SERVICE_URL}/api/payments/process`,
      { orderId: order.id, amount: total },
    );
    paymentResult = data.payment;
  } catch (err) {
    paymentResult = err.response?.data?.payment;
    if (!paymentResult) {
      console.error('payment service unreachable', err.message);
      await db.update(orders).set({ status: 'failed' }).where(eq(orders.id, order.id));
      return res.status(502).json({ error: 'Payment service unavailable', orderId: order.id });
    }
  }

  const finalStatus = paymentResult.status === 'success' ? 'paid' : 'failed';
  await db.update(orders).set({ status: finalStatus }).where(eq(orders.id, order.id));

  if (finalStatus === 'paid') {
    try {
      await http.delete(`${process.env.CART_SERVICE_URL}/api/cart/clear`);
    } catch (err) {
      console.error('cart clear failed', err.message);
    }
  }

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  res.status(finalStatus === 'paid' ? 201 : 402).json({
    order: { ...order, status: finalStatus, items },
    payment: paymentResult,
  });
}

export async function list(req, res) {
  const userId = req.user.userId;
  const rows = await db.select().from(orders)
    .where(eq(orders.userId, userId))
    .orderBy(desc(orders.createdAt));
  res.json({ orders: rows });
}

export async function getOne(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });

  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.userId !== req.user.userId && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  res.json({ order: { ...order, items } });
}
