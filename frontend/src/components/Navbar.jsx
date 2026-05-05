import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useCart } from '../contexts/CartContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { items } = useCart();
  const navigate = useNavigate();
  const cartCount = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <nav className="navbar">
      <Link to="/" className="brand">ShopSphere</Link>
      <div className="navbar-links">
        <Link to="/">Products</Link>
        {user && <Link to="/cart">Cart{cartCount > 0 ? ` (${cartCount})` : ''}</Link>}
        {user && <Link to="/orders">Orders</Link>}
        {user ? (
          <>
            <span className="muted">{user.email}</span>
            <button onClick={() => { logout(); navigate('/'); }}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Register</Link>
          </>
        )}
      </div>
    </nav>
  );
}
