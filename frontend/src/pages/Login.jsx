import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error ?? 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container">
      <h1>Login</h1>
      <form className="form" onSubmit={onSubmit}>
        <label>Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>Password
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <div className="error">{typeof error === 'string' ? error : 'Login failed'}</div>}
        <button type="submit" disabled={submitting}>{submitting ? 'Logging in…' : 'Login'}</button>
        <div className="muted">Need an account? <Link to="/register">Register</Link></div>
      </form>
    </div>
  );
}
