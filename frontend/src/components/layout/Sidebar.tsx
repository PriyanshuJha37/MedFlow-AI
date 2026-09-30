import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Role } from '../../types';

const staffLinks: Array<{ to: string; label: string }> = [
  { to: '/staff/dashboard', label: 'Dashboard' },
  { to: '/staff/medicines', label: 'Medicines' },
  { to: '/staff/footfall', label: 'Footfall' },
  { to: '/staff/beds', label: 'Beds' },
  { to: '/staff/attendance', label: 'Attendance' },
  { to: '/staff/emergency', label: 'Emergency' },
];

const adminLinks: Array<{ to: string; label: string }> = [
  { to: '/admin/overview', label: 'Overview' },
  { to: '/admin/medicines', label: 'Medicines' },
  { to: '/admin/footfall', label: 'Footfall' },
  { to: '/admin/beds', label: 'Beds' },
  { to: '/admin/staff', label: 'Staff' },
  { to: '/admin/alerts', label: 'Alerts' },
  { to: '/admin/analytics', label: 'Analytics' },
  { to: '/admin/transfers', label: 'Transfers' },
  { to: '/admin/simulation', label: 'Simulation' },
  { to: '/admin/federated', label: 'Federated AI' },
];

const Sidebar: React.FC = () => {
  const { user } = useAuth();
  const role: Role = user?.role || 'phc_staff';
  const links = role === 'admin' ? adminLinks : staffLinks;

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-emerald-950 text-emerald-50 flex flex-col z-30">
      <div className="h-16 flex items-center px-6 border-b border-emerald-900/60">
        <h2 className="text-xl font-bold text-emerald-300">MedFlow</h2>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
        <ul className="space-y-1 px-3">
          {links.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                className={({ isActive }) =>
                  `block px-4 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-600 text-white'
                      : 'text-emerald-100/80 hover:bg-emerald-900/60 hover:text-white'
                  }`
                }
              >
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <div className="p-4 border-t border-emerald-900/60">
        <p className="text-xs text-emerald-400/70">
          {role === 'admin' ? 'Administrator Panel' : 'PHC Staff Panel'}
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;
