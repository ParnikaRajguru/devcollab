import { useAuth } from '../auth/AuthContext';

export default function HomePage() {
  const { user, logout } = useAuth();

  return (
    <div className="home-card">
      <h2>Welcome, {user?.name}</h2>
      <p>You are logged in as {user?.email}</p>
      <button onClick={logout}>Log out</button>
    </div>
  );
}