import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      // On success AuthProvider sets user state; App.tsx then auto-redirects
      // to /home because the "/" and "/login" routes check `user`.
      await login(email, password);
    } catch (err) {
      // err.message holds the server's response message (e.g. "Invalid credentials")
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <h2>Log in to DevCollab</h2>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <div className="error">{error}</div>
      <button type="submit">Log in</button>
      <div className="link">
        Don&apos;t have an account? <Link to="/register">Create one</Link>
      </div>
    </form>
  );
}