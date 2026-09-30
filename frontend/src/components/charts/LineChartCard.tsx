import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export interface LineKey {
  key: string;
  label: string;
  color: string;
  strokeWidth?: number;
}

interface Props {
  title: string;
  data: any[];
  keys: LineKey[];
  xKey?: string;
  height?: number;
  legend?: boolean;
  subtitle?: string;
}

const LineChartCard: React.FC<Props> = ({
  title,
  data,
  keys,
  xKey = 'date',
  height = 300,
  legend = true,
  subtitle,
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 h-full flex flex-col">
      <div className="mb-3">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex-1" style={{ minHeight: height - 20 }}>
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            No data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 15, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey={xKey}
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                }}
              />
              {legend && <Legend wrapperStyle={{ fontSize: '12px' }} />}
              {keys.map((k) => (
                <Line
                  key={k.key}
                  type="monotone"
                  dataKey={k.key}
                  name={k.label}
                  stroke={k.color}
                  strokeWidth={k.strokeWidth ?? 2}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default LineChartCard;
