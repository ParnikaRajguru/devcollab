import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { apiFetch } from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string;
}

interface AuthTokens {
  user: User;
  accessToken: string;
  refreshToken: string;
}

interface AuthContextValue {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// AuthProvider: wraps the app, holds user state in memory (backed by
// localStorage for persistence across page reloads). login/register call
// the API, stash tokens in localStorage, then set `user` in state.
// On mount, it checks localStorage for an existing token and fetches
// /users/me to validate it before restoring the session.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  // On first mount, if tokens exist but user state was lost (page refresh),
  // re-validate the session by hitting /users/me.
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setUser(null);
      localStorage.removeItem('user');
      return;
    }
    apiFetch<User>('/users/me')
      .then((u) => {
        setUser(u);
        localStorage.setItem('user', JSON.stringify(u));
      })
      .catch(() => {
        setUser(null);
        localStorage.removeItem('user');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<AuthTokens>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    setUser(data.user);
  }, []);

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      // Register creates the user; they must then log in.
      await apiFetch('/users', { method: 'POST', body: { email, password, name } });
      await login(email, password);
    },
    [login],
  );

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Safe hook: returns typed context or throws a clear error if used outside
// the provider — catches the most common mistake instantly.
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}