import { db } from './db.js';
import { products } from './schema.js';

const SEED_PRODUCTS = [
  { name: 'Wireless Headphones', description: 'Noise-cancelling over-ear headphones with 40h battery.', price: 199.99, stock: 25, imageUrl: 'https://placehold.co/400x300?text=Headphones' },
  { name: 'Mechanical Keyboard', description: '75% layout, hot-swap, RGB.', price: 129.0, stock: 40, imageUrl: 'https://placehold.co/400x300?text=Keyboard' },
  { name: '4K Monitor', description: '27" IPS display with USB-C.', price: 449.5, stock: 15, imageUrl: 'https://placehold.co/400x300?text=Monitor' },
  { name: 'Ergonomic Mouse', description: 'Vertical design, rechargeable.', price: 59.9, stock: 60, imageUrl: 'https://placehold.co/400x300?text=Mouse' },
  { name: 'USB-C Hub', description: '7-in-1 with HDMI, SD, ethernet.', price: 39.95, stock: 80, imageUrl: 'https://placehold.co/400x300?text=USB-C+Hub' },
  { name: 'Standing Desk', description: 'Electric height-adjustable, 60x30".', price: 599.0, stock: 8, imageUrl: 'https://placehold.co/400x300?text=Desk' },
  { name: 'Webcam 1080p', description: 'Auto-focus, dual mics.', price: 79.0, stock: 35, imageUrl: 'https://placehold.co/400x300?text=Webcam' },
  { name: 'Laptop Stand', description: 'Aluminum, foldable.', price: 34.99, stock: 100, imageUrl: 'https://placehold.co/400x300?text=Stand' },
  { name: 'Bluetooth Speaker', description: 'Waterproof, 12h playback.', price: 89.0, stock: 30, imageUrl: 'https://placehold.co/400x300?text=Speaker' },
  { name: 'Smart Bulb (4-pack)', description: 'Color-changing, app-controlled.', price: 49.99, stock: 50, imageUrl: 'https://placehold.co/400x300?text=Bulb' },
];

export async function seedIfEmpty() {
  const existing = await db.select().from(products).limit(1);
  if (existing.length > 0) return;
  console.log('product-service: seeding sample products');
  await db.insert(products).values(SEED_PRODUCTS);
}
