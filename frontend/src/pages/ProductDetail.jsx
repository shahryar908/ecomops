import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productApi } from '../api/client.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useCart } from '../contexts/CartContext.jsx';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { add } = useCart();

  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    productApi.get(`/api/products/${id}`)
      .then((res) => setProduct(res.data.product))
      .catch((err) => setError(err.response?.data?.error ?? err.message));
  }, [id]);

  async function onAdd() {
    if (!user) return navigate('/login');
    setAdding(true);
    setError('');
    try {
      await add(product.id, quantity);
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    } catch (err) {
      setError(err.response?.data?.error ?? 'Could not add to cart');
    } finally {
      setAdding(false);
    }
  }

  if (!product) return <div className="container">{error || 'Loading…'}</div>;

  return (
    <div className="container">
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        {product.imageUrl && <img src={product.imageUrl} alt={product.name} style={{ width: 320, borderRadius: 8 }} />}
        <div style={{ flex: 1, minWidth: 280 }}>
          <h1>{product.name}</h1>
          <p>{product.description}</p>
          <div className="price" style={{ fontSize: '1.5rem' }}>${product.price.toFixed(2)}</div>
          <div className="muted" style={{ marginBottom: '1rem' }}>{product.stock} in stock</div>
          <div className="row">
            <input
              type="number"
              min={1}
              max={product.stock}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
              style={{ width: 80 }}
            />
            <button onClick={onAdd} disabled={adding || product.stock === 0}>
              {adding ? 'Adding…' : product.stock === 0 ? 'Out of stock' : 'Add to cart'}
            </button>
          </div>
          {added && <div className="success" style={{ marginTop: '0.5rem' }}>Added to cart</div>}
          {error && <div className="error" style={{ marginTop: '0.5rem' }}>{typeof error === 'string' ? error : 'Error'}</div>}
        </div>
      </div>
    </div>
  );
}
