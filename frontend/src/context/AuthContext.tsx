import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User, LoginResponse, LoginRequest } from '../types';
import apiClient from '../api/client';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const logout = useCallback(() => {
    localStorage.removeItem('medflow_token');
    localStorage.removeItem('medflow_user');
    setUser(null);
    setToken(null);
    window.location.href = '/login';
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const body: LoginRequest = { username, password };
    const response = await apiClient.post<LoginResponse>('/auth/login', body);
    const { token: newToken, user: newUser } = response.data;

    localStorage.setItem('medflow_token', newToken);
    localStorage.setItem('medflow_user', JSON.stringify(newUser));

    setToken(newToken);
    setUser(newUser);
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('medflow_token');
      const storedUserStr = localStorage.getItem('medflow_user');

      if (!storedToken) {
        setLoading(false);
        return;
      }

      try {
        setToken(storedToken);

        if (storedUserStr) {
          try {
            const parsedUser: User = JSON.parse(storedUserStr);
            setUser(parsedUser);
          } catch {
            // ignore parse error
          }
        }

        const response = await apiClient.get<User>('/auth/me');
        setUser(response.data);
        localStorage.setItem('medflow_user', JSON.stringify(response.data));
      } catch {
        localStorage.removeItem('medflow_token');
        localStorage.removeItem('medflow_user');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
