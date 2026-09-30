import React from 'react';
import { AdminPHCSummary } from '../../types';
import { fmtNumber, fmtPct, fmtTimeAgo } from '../../lib/format';
import { riskColour } from '../../lib/riskColour';

interface Props {
  phc: AdminPHCSummary;
}

const PHCCard: React.FC<Props> = ({ phc }) => {
  const stockCol = riskColour(100 - phc.stockHealth);
  const bedsCol =
    phc.bedsOccupiedPct > 85
      ? 'bg-red-500'
      : phc.bedsOccupiedPct > 70
      ? 'bg-yellow-500'
      : 'bg-emerald-500';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col h-full hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-900 text-lg">{phc.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {phc.zone} · {phc.city}
          </p>
        </div>
        {phc.activeEmergency && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 ring-1 ring-red-200">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            EMERGENCY
          </span>
        )}
      </div>

      <div className="space-y-3 flex-1">
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-500">Beds</span>
            <span className="font-semibold text-gray-900">
              {fmtNumber(phc.bedsOccupied)}/{fmtNumber(phc.bedsTotal)}
            </span>
          </div>
          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${bedsCol}`}
              style={{ width: `${Math.min(phc.bedsOccupiedPct, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">{fmtPct(phc.bedsOccupiedPct)} occupied</p>
        </div>

        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-gray-500">Staff</span>
            <span className="font-semibold text-gray-900">
              {fmtNumber(phc.staffOnDuty)}/{fmtNumber(phc.staffTotal)}
            </span>
          </div>
          <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${Math.min(phc.staffOnDutyPct, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">{fmtPct(phc.staffOnDutyPct)} on-duty</p>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-sm text-gray-500">Stock Health</span>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${stockCol.bg} ${stockCol.text}`}
          >
            {fmtPct(phc.stockHealth)}
          </span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-400">Updated {fmtTimeAgo(phc.lastUpdated)}</p>
      </div>
    </div>
  );
};

export default PHCCard;
