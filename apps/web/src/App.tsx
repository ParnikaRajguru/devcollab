import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import ProtectedRoute from './auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';

// Routes = top-level page switch. Navigate catches unknown paths.
// If logged in, redirect "/" away from login/register to the home page.
// ProtectedRoute wraps pages that require a valid token.
export default function App() {
  const { user } = useAuth();

  return (
    <div className="app">
      <Routes>
        <Route
          path="/"
          element={
            user ? <Navigate to="/home" replace /> : <Navigate to="/login" replace />
          }
        />
        <Route
          path="/login"
          element={user ? <Navigate to="/home" replace /> : <LoginPage />}
        />
        <Route
          path="/register"
          element={user ? <Navigate to="/home" replace /> : <RegisterPage />}
        />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}