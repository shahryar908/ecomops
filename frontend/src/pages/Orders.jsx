import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { orderApi } from '../api/client.js';

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    orderApi.get('/api/orders')
      .then((res) => setOrders(res.data.orders))
      .catch((err) => setError(err.response?.data?.error ?? err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="container">Loading orders…</div>;

  return (
    <div className="container">
      <h1>Your Orders</h1>
      {error && <div className="error">{typeof error === 'string' ? error : 'Error'}</div>}
      {orders.length === 0 ? (
        <p>No orders yet. <Link to="/">Browse products</Link></p>
      ) : (
        <table>
          <thead>
            <tr><th>Order #</th><th>Date</th><th>Total</th><th>Status</th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td><Link to={`/orders/${o.id}`}>#{o.id}</Link></td>
                <td>{o.createdAt}</td>
                <td>${o.total.toFixed(2)}</td>
                <td><span className={`status-${o.status}`}>{o.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
