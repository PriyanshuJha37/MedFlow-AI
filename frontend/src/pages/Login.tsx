import React, { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../hooks/useToast';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const { pushToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!username.trim() || !password.trim()) {
      pushToast('error', 'Username and password are required.');
      return;
    }

    setSubmitting(true);
    try {
      await login(username.trim(), password);
      const userStr = localStorage.getItem('medflow_user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user.role === 'admin') {
            navigate('/admin/overview', { replace: true });
          } else {
            navigate('/staff/dashboard', { replace: true });
          }
        } catch {
          navigate('/', { replace: true });
        }
      } else {
        navigate('/', { replace: true });
      }
      pushToast('success', 'Login successful!');
    } catch (err: any) {
      const message = err?.response?.data?.message || 'Login failed. Please try again.';
      pushToast('error', message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">MedFlow</h1>
          <p className="text-gray-500">Healthcare Management System</p>
        </div>
        <div className="bg-white rounded-xl shadow-xl p-8 border border-gray-100">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6 text-center">Sign In</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1.5">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                placeholder="Enter your username"
                autoComplete="username"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-colors"
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
          <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-500 text-center mb-2">Demo Credentials:</p>
            <p className="text-xs text-gray-600 text-center">
              <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">admin / admin123</span>
              <span className="mx-2">or</span>
              <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">phc1_staff / phc1pass</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
