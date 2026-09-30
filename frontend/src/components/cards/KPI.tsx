import React from 'react';

interface Props {
  title: string;
  value: string | number;
  subValue?: string;
  accent?: 'emerald' | 'green' | 'yellow' | 'red' | 'orange' | 'gray';
  icon?: React.ReactNode;
  progress?: number;
}

const accentCls: Record<NonNullable<Props['accent']>, string> = {
  emerald: 'text-emerald-700',
  green: 'text-green-600',
  yellow: 'text-yellow-600',
  red: 'text-red-600',
  orange: 'text-orange-600',
  gray: 'text-gray-600',
};

const progressCls: Record<NonNullable<Props['accent']>, string> = {
  emerald: 'bg-emerald-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
  orange: 'bg-orange-500',
  gray: 'bg-gray-500',
};

const KPI: React.FC<Props> = ({ title, value, subValue, accent = 'emerald', icon, progress }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        {icon && <span className={accentCls[accent]}>{icon}</span>}
      </div>
      <p className={`text-3xl font-bold ${accentCls[accent]}`}>{value}</p>
      {subValue && <p className="text-sm text-gray-500 mt-1">{subValue}</p>}
      {typeof progress === 'number' && (
        <div className="mt-3 h-2 w-full bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${progressCls[accent]}`}
            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default KPI;
