import React from 'react';
import { useAuth } from '../../context/AuthContext';

const Topbar: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shadow-sm">
      <div className="flex items-center">
        <h1 className="text-lg font-semibold text-gray-800">MedFlow</h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">
            {user?.displayName ?? user?.username}
          </span>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              user?.role === 'admin'
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {user?.role === 'admin' ? 'Admin' : 'PHC Staff'}
          </span>
        </div>
        <button
          onClick={logout}
          className="px-4 py-2 text-sm font-medium text-white bg-emerald-700 rounded-md hover:bg-emerald-800 transition-colors"
        >
          Logout
        </button>
      </div>
    </header>
  );
};

export default Topbar;
