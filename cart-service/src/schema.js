import { pgTable, serial, integer, doublePrecision, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

export const cartItems = pgTable(
  'cart_items',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull(),
    productId: integer('product_id').notNull(),
    quantity: integer('quantity').notNull(),
    priceAtAdd: doublePrecision('price_at_add').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userProductUnique: uniqueIndex('user_product_idx').on(table.userId, table.productId),
  }),
);

export const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS cart_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price_at_add DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS user_product_idx ON cart_items(user_id, product_id);
`;
