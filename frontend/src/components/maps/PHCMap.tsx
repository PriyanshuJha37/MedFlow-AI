import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import { AdminPHCSummary } from '../../types';
import { fmtNumber, fmtPct, fmtTimeAgo } from '../../lib/format';
import { riskColour } from '../../lib/riskColour';

interface Props {
  phcs: AdminPHCSummary[];
}

type StatusLevel = 'critical' | 'warning' | 'normal';

function getOverallStatus(phc: AdminPHCSummary): StatusLevel {
  if (phc.activeEmergency) return 'critical';
  const stockRisk = 100 - phc.stockHealth;
  const bedRisk = phc.bedsOccupiedPct;
  const staffRisk = 100 - phc.staffOnDutyPct;
  const composite = Math.max(stockRisk, bedRisk * 0.9, staffRisk * 0.8);
  if (composite >= 80) return 'critical';
  if (composite >= 55) return 'warning';
  return 'normal';
}

function isAbundant(phc: AdminPHCSummary): boolean {
  return (
    phc.stockHealth >= 85 &&
    phc.bedsOccupiedPct <= 50 &&
    phc.staffOnDutyPct >= 80 &&
    !phc.activeEmergency
  );
}

const statusDot: Record<StatusLevel, string> = {
  critical: '#ef4444',
  warning: '#eab308',
  normal: '#10b981',
};

const statusBg: Record<StatusLevel, string> = {
  critical: 'bg-red-500',
  warning: 'bg-yellow-500',
  normal: 'bg-emerald-500',
};

const statusLabel: Record<StatusLevel, string> = {
  critical: 'Critical attention',
  warning: 'Warning / monitor',
  normal: 'All systems normal',
};

function buildMarkerIcon(color: string, hasEmergency: boolean) {
  const size = hasEmergency ? 38 : 30;
  const pulseRing = hasEmergency
    ? `<span style="position:absolute;inset:-4px;border-radius:9999px;border:2px solid ${color};animation:phc-pulse 1.4s ease-out infinite;opacity:0.8;"></span>`
    : '';
  return L.divIcon({
    className: 'phc-marker-wrapper',
    html: `<div style="position:relative;width:${size}px;height:${size}px;">
      ${pulseRing}
      <div style="width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${size * 0.38}px;letter-spacing:0.5px;">
      </div>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2) - 2],
  });
}

const PHCMap: React.FC<Props> = ({ phcs }) => {
  const phcsWithCoords = useMemo(
    () => phcs.filter((p) => typeof p.lat === 'number' && typeof p.lng === 'number'),
    [phcs]
  );

  const center: [number, number] = useMemo(() => {
    if (phcsWithCoords.length === 0) return [28.6139, 77.209];
    const avgLat = phcsWithCoords.reduce((s, p) => s + (p.lat as number), 0) / phcsWithCoords.length;
    const avgLng = phcsWithCoords.reduce((s, p) => s + (p.lng as number), 0) / phcsWithCoords.length;
    return [avgLat, avgLng];
  }, [phcsWithCoords]);

  const zoom = phcsWithCoords.length > 1 ? 11 : 13;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="font-bold text-gray-900">PHC Geographic Map</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {phcsWithCoords.length} of {phcs.length} centres mapped · click markers for details
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          {(Object.keys(statusLabel) as StatusLevel[]).map((lvl) => (
            <div key={lvl} className="flex items-center gap-1.5">
              <span className={`inline-block w-3 h-3 rounded-full ${statusBg[lvl]} ring-2 ring-white shadow-sm`} />
              <span className="text-gray-600">{statusLabel[lvl]}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes phc-pulse {
          0%   { transform: scale(0.9); opacity: 0.9; }
          80%  { transform: scale(1.7); opacity: 0;  }
          100% { transform: scale(1.7); opacity: 0;  }
        }
        .phc-marker-wrapper { background: transparent !important; border: none !important; }
        .leaflet-popup-content-wrapper { border-radius: 12px; }
        .leaflet-popup-content { margin: 0; width: 320px !important; }
      `}</style>

      {phcsWithCoords.length === 0 ? (
        <div className="h-[480px] flex items-center justify-center text-sm text-gray-500 bg-gray-50">
          No PHC coordinates available for mapping.
        </div>
      ) : (
        <MapContainer
          center={center}
          zoom={zoom}
          scrollWheelZoom={true}
          style={{ height: '480px', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {phcsWithCoords.map((phc) => {
            const status = getOverallStatus(phc);
            const color = statusDot[status];
            const icon = buildMarkerIcon(color, phc.activeEmergency);

            const stockCol = riskColour(100 - phc.stockHealth);
            const bedsCol =
              phc.bedsOccupiedPct > 85
                ? 'bg-red-500'
                : phc.bedsOccupiedPct > 70
                ? 'bg-yellow-500'
                : 'bg-emerald-500';
            const staffCol =
              phc.staffOnDutyPct < 55
                ? 'bg-red-500'
                : phc.staffOnDutyPct < 70
                ? 'bg-yellow-500'
                : 'bg-emerald-500';

            return (
              <div key={phc.id}>
                <Circle
                  center={[phc.lat as number, phc.lng as number]}
                  radius={450}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.1, weight: 1 }}
                />
                <Marker
                  position={[phc.lat as number, phc.lng as number]}
                  icon={icon}
                >
                  <Popup>
                    <div className="p-4 text-sm">
                      <div className="flex items-start justify-between gap-2 mb-3 pb-3 border-b border-gray-100">
                        <div>
                          <h4 className="font-bold text-gray-900 leading-snug">{phc.name}</h4>
                          <p className="text-xs text-gray-500 mt-1">
                            {phc.zone} · {phc.city}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${
                              status === 'critical'
                                ? 'bg-red-100 text-red-700 ring-red-200'
                                : status === 'warning'
                                ? 'bg-yellow-100 text-yellow-700 ring-yellow-200'
                                : 'bg-emerald-100 text-emerald-700 ring-emerald-200'
                            }`}
                          >
                            {statusLabel[status]}
                          </span>
                          {isAbundant(phc) && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset bg-emerald-50 text-emerald-800 ring-emerald-200">
                              ✨ Abundant
                            </span>
                          )}
                        </div>
                      </div>

                      {phc.activeEmergency && (
                        <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-xs text-red-700 font-semibold flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                          Active emergency in progress
                        </div>
                      )}

                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-gray-500">Medicine / Stock Health</span>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ring-inset ${stockCol.bg} ${stockCol.text}`}
                            >
                              {fmtPct(phc.stockHealth)}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                phc.stockHealth >= 70
                                  ? 'bg-emerald-500'
                                  : phc.stockHealth >= 40
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${phc.stockHealth}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-gray-500">
                              Beds ({fmtNumber(phc.bedsOccupied)}/{fmtNumber(phc.bedsTotal)})
                            </span>
                            <span className="font-semibold text-gray-900">
                              {fmtPct(phc.bedsOccupiedPct)}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${bedsCol}`}
                              style={{ width: `${Math.min(phc.bedsOccupiedPct, 100)}%` }}
                            />
                          </div>
                          {phc.bedsEmergencyReserved > 0 && (
                            <p className="text-[11px] text-gray-500 mt-1">
                              +{phc.bedsEmergencyReserved} emergency-reserved
                            </p>
                          )}
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-gray-500">
                              Staff on-duty ({fmtNumber(phc.staffOnDuty)}/{fmtNumber(phc.staffTotal)})
                            </span>
                            <span className="font-semibold text-gray-900">
                              {fmtPct(phc.staffOnDutyPct)}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${staffCol}`}
                              style={{ width: `${Math.min(phc.staffOnDutyPct, 100)}%` }}
                            />
                          </div>
                        </div>

                        <div className="pt-1 flex items-center justify-between">
                          <span className="text-gray-500">Patient load / footfall</span>
                          <span className="font-semibold text-gray-900">
                            {fmtNumber(phc.lastPatientCount)} today
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-gray-100 text-[11px] text-gray-400">
                        Updated {fmtTimeAgo(phc.lastUpdated)}
                      </div>
                    </div>
                  </Popup>
                </Marker>
              </div>
            );
          })}
        </MapContainer>
      )}
    </div>
  );
};

export default PHCMap;
