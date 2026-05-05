import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { productApi } from '../api/client.js';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    productApi.get('/api/products')
      .then((res) => setProducts(res.data.products))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container">
      <h1>Products</h1>
      {loading && <div>Loading…</div>}
      {error && <div className="error">{error}</div>}
      <div className="product-grid">
        {products.map((p) => (
          <Link key={p.id} to={`/products/${p.id}`} className="card">
            {p.imageUrl && <img src={p.imageUrl} alt={p.name} />}
            <h3>{p.name}</h3>
            <div className="price">${p.price.toFixed(2)}</div>
            <div className="muted">{p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
