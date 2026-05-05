import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext.jsx';
import { orderApi } from '../api/client.js';

export default function Checkout() {
  const { items, total, refresh } = useCart();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function placeOrder() {
    setSubmitting(true);
    setError('');
    try {
      const { data } = await orderApi.post('/api/orders', {});
      await refresh();
      navigate(`/orders/${data.order.id}`);
    } catch (err) {
      const payload = err.response?.data;
      if (payload?.order) {
        await refresh();
        navigate(`/orders/${payload.order.id}`);
        return;
      }
      setError(payload?.error ?? err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return <div className="container"><p>Your cart is empty.</p></div>;
  }

  return (
    <div className="container">
      <h1>Checkout</h1>
      <table>
        <thead>
          <tr><th>Product</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>{item.product?.name ?? `Product #${item.productId}`}</td>
              <td>{item.quantity}</td>
              <td>${item.priceAtAdd.toFixed(2)}</td>
              <td>${(item.priceAtAdd * item.quantity).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 style={{ marginTop: '1.5rem' }}>Total: ${total.toFixed(2)}</h2>
      <p className="muted">Payment is mocked — there's a ~10% chance the simulated transaction fails.</p>
      {error && <div className="error">{typeof error === 'string' ? error : 'Order failed'}</div>}
      <button onClick={placeOrder} disabled={submitting}>
        {submitting ? 'Placing order…' : 'Place order'}
      </button>
    </div>
  );
}
