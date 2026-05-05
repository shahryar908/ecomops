import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext.jsx';

export default function Cart() {
  const { items, total, loading, remove } = useCart();
  const navigate = useNavigate();

  if (loading) return <div className="container">Loading cart…</div>;

  return (
    <div className="container">
      <h1>Your Cart</h1>
      {items.length === 0 ? (
        <p>Your cart is empty. <Link to="/">Browse products</Link></p>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Price</th>
                <th>Subtotal</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.product?.name ?? `Product #${item.productId}`}</td>
                  <td>{item.quantity}</td>
                  <td>${item.priceAtAdd.toFixed(2)}</td>
                  <td>${(item.priceAtAdd * item.quantity).toFixed(2)}</td>
                  <td>
                    <button onClick={() => remove(item.productId)} style={{ background: '#dc2626' }}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong>Total: ${total.toFixed(2)}</strong>
            <button onClick={() => navigate('/checkout')}>Checkout</button>
          </div>
        </>
      )}
    </div>
  );
}
