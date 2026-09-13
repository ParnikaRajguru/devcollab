import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

// ProtectedRoute: wraps any page that needs a logged-in user. If `user` is
// null it redirects to /login (never renders the children). This is the
// declarative alternative to manually checking auth in every page.
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}