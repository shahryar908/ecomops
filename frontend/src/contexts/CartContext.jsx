import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { cartApi } from '../api/client.js';
import { useAuth } from './AuthContext.jsx';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) { setItems([]); setTotal(0); return; }
    setLoading(true);
    try {
      const { data } = await cartApi.get('/api/cart');
      setItems(data.items);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  async function add(productId, quantity = 1) {
    await cartApi.post('/api/cart/add', { productId, quantity });
    await refresh();
  }

  async function remove(productId) {
    await cartApi.delete(`/api/cart/${productId}`);
    await refresh();
  }

  return (
    <CartContext.Provider value={{ items, total, loading, refresh, add, remove }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be inside CartProvider');
  return ctx;
}
