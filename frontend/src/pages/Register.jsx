import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await register(name, email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error ?? 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container">
      <h1>Register</h1>
      <form className="form" onSubmit={onSubmit}>
        <label>Name
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>Password
          <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <div className="error">{typeof error === 'string' ? error : 'Registration failed'}</div>}
        <button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create account'}</button>
        <div className="muted">Have an account? <Link to="/login">Login</Link></div>
      </form>
    </div>
  );
}
