import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { orderApi } from '../api/client.js';

export default function OrderDetail() {
  const { id } = useParams();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    orderApi.get(`/api/orders/${id}`)
      .then((res) => setOrder(res.data.order))
      .catch((err) => setError(err.response?.data?.error ?? err.message));
  }, [id]);

  if (error) return <div className="container"><div className="error">{typeof error === 'string' ? error : 'Error'}</div></div>;
  if (!order) return <div className="container">Loading…</div>;

  return (
    <div className="container">
      <h1>Order #{order.id}</h1>
      <p>
        Status: <span className={`status-${order.status}`}>{order.status}</span><br />
        Placed: <span className="muted">{order.createdAt}</span>
      </p>
      <table>
        <thead>
          <tr><th>Product</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr>
        </thead>
        <tbody>
          {order.items?.map((item) => (
            <tr key={item.id}>
              <td>{item.name}</td>
              <td>{item.quantity}</td>
              <td>${item.price.toFixed(2)}</td>
              <td>${(item.price * item.quantity).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2 style={{ marginTop: '1.5rem' }}>Total: ${order.total.toFixed(2)}</h2>
      <Link to="/orders">← Back to orders</Link>
    </div>
  );
}
