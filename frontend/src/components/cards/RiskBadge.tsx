import React from 'react';
import { riskColour } from '../../lib/riskColour';

interface Props {
  score: number;
  size?: 'sm' | 'md';
}

const RiskBadge: React.FC<Props> = ({ score, size = 'sm' }) => {
  const col = riskColour(score);
  const pad = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2.5 py-0.5 text-xs';
  return (
    <span
      className={`inline-flex items-center ${pad} rounded-full font-semibold ring-1 ring-inset ${col.bg} ${col.text}`}
    >
      {score}
    </span>
  );
};

export default RiskBadge;
